#!/usr/bin/env node
/**
 * maptiles-to-tif.mjs —— 把 mbtiles 里的影像瓦片按 Web Mercator（EPSG:3857）
 * 流式拼接成单张 GeoTIFF。
 *
 * 特点：
 *  - 逐 strip（一行瓦片 = 256 像素高）解码→拼接→压缩→写盘，内存占用低，
 *    不会一次性把整张大图载入内存（z14 全图约 709 MP 也扛得住）。
 *  - 默认取 mbtiles 里最高 zoom 作为单张主图（最通用、兼容性最好）；
 *    如需把低 zoom 一并写入同一个文件做 overview，用 --zoom=14,13（多 IFD）。
 *  - 纯 JS 实现（jpeg-js 解码 + 内置 zlib 压缩），不依赖 GDAL。
 *
 * 用法：
 *   node ./src/maptiles-to-tif.mjs --mbtiles=./output/msn_image_shaoguan_13_14.mbtiles
 *   node ./src/maptiles-to-tif.mjs --mbtiles=... --out=./output/sg.tif
 *   node ./src/maptiles-to-tif.mjs --mbtiles=... --zoom=14        # 指定层级（默认最高层）
 *   node ./src/maptiles-to-tif.mjs --mbtiles=... --zoom=14,13     # 14 主图 + 13 overview（单文件多 IFD）
 *   node ./src/maptiles-to-tif.mjs --mbtiles=... --bbox=112.6,23.6,115.0,25.8  # 覆盖 bbox
 *   node ./src/maptiles-to-tif.mjs --mbtiles=... --compression=none  # 不压缩（体积大）
 *   node ./src/maptiles-to-tif.mjs --mbtiles=... --verify        # 写完后自校验
 */
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { deflateSync, inflateSync } from 'node:zlib'
import Database from 'better-sqlite3'
import { decode as decodeJpeg } from 'jpeg-js'
import { PNG } from 'pngjs'
import { bboxToTileRange, tmsY } from './utils/tile.mjs'

/* ===================== 常量 ===================== */
const TILE = 256 // 瓦片尺寸
const WORLD_HALF = 20037508.342789244 // Web Mercator 半宽（米）
const SOFTWARE = 'maptiles-downloader'
const SOFTWARE_LEN = SOFTWARE.length + 1 // 含结尾 \0

/* ===================== 参数 ===================== */
function parseArgs() {
  const args = process.argv.slice(2)
  const params = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const [key, value] = args[i].substring(2).split('=')
      params[key] = value || true
    }
  }
  return params
}

/* ===================== mbtiles 元数据 ===================== */
function readMetadata(db) {
  const rows = db.prepare('SELECT name, value FROM metadata').all()
  const meta = Object.fromEntries(rows.map(r => [r.name, r.value]))
  const [w, s, e, n] = (meta.bounds ?? '-180,-85.0511,180,85.0511')
    .split(',')
    .map(Number)
  return {
    name: meta.name ?? 'MSN Image',
    format: meta.format ?? 'jpg',
    bounds: [w, s, e, n],
    minzoom: Number(meta.minzoom ?? 0),
    maxzoom: Number(meta.maxzoom ?? 0)
  }
}

/* ===================== 网格 / 地理参考 ===================== */
function computeGrid(bounds, z) {
  const r = bboxToTileRange(bounds, z)
  const cols = r.maxX - r.minX + 1
  const rows = r.maxY - r.minY + 1
  const width = cols * TILE
  const height = rows * TILE
  const res = (WORLD_HALF * 2) / (2 ** z) / TILE // 米/像素
  const originX = r.minX * TILE * res - WORLD_HALF // 左上角东坐标
  const originY = WORLD_HALF - r.minY * TILE * res // 左上角北坐标
  return { ...r, cols, rows, width, height, res, originX, originY }
}

/* ===================== 拼接一条 strip ===================== */
// 同时支持 PNG / JPEG 瓦片（天地图可能返回 PNG），都解成 RGBA
function decodeTile(buf) {
  if (
    buf.length > 8
    && buf[0] === 0x89
    && buf[1] === 0x50
    && buf[2] === 0x4E
    && buf[3] === 0x47
  ) {
    // pngjs 无内置类型声明，PNG.sync 由 lib/png.js 在运行时注入
    // @ts-ignore
    return PNG.sync.read(buf)
  }
  return decodeJpeg(buf, { useTArray: true })
}

function buildStrip(db, grid, z, stripIndex) {
  const y = grid.minY + stripIndex // XYZ 行号（北→南）
  const band = Buffer.alloc(grid.width * TILE * 3) // RGB，黑底
  const stmt = db.prepare(
    'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
  )

  for (let x = grid.minX; x <= grid.maxX; x++) {
    const row = stmt.get(z, x, tmsY(y, z))
    if (!row?.tile_data) {
      console.warn(`  ⚠️ 缺瓦片 z${z}/${x}/${y}（该处保持黑色）`)
      continue
    }
    try {
      const px = decodeTile(row.tile_data)
      const slot = (x - grid.minX) * TILE
      const copyW = Math.min(px.width, TILE)
      const copyH = Math.min(px.height, TILE)
      const src = px.data
      const dst = band
      const gstride = grid.width
      for (let yy = 0; yy < copyH; yy++) {
        const si = yy * px.width * 4
        let di = (yy * gstride + slot) * 3
        for (let xx = 0; xx < copyW; xx++) {
          const si4 = si + xx * 4
          dst[di++] = src[si4]
          dst[di++] = src[si4 + 1]
          dst[di++] = src[si4 + 2]
        }
      }
    }
    catch (err) {
      console.warn(`  ⚠️ 解码失败 z${z}/${x}/${y}: ${err.message}`)
    }
  }
  return band
}

/* ===================== TIFF 结构布局 ===================== */
// 16 个 IFD 条目
const IFD_SIZE = 2 + 16 * 12 + 4 // 198 字节

function extrasLayout(stripCount) {
  let off = 0
  const bits = off
  off += 6 // BitsPerSample: 3 * uint16
  const software = off
  off += SOFTWARE_LEN
  const geokey = off
  off += 48 // GeoKeyDirectory: 24 * uint16
  const geoascii = off
  off += 26 // 'WGS 84 / Pseudo-Mercator\0'
  const geodouble = off
  off += 0 // 空
  const pixscale = off
  off += 24 // ModelPixelScale: 3 * float64
  const tiepoint = off
  off += 48 // ModelTiepoint: 6 * float64
  const stripOffsets = off
  off += 4 * stripCount
  const stripByteCounts = off
  off += 4 * stripCount
  return {
    bits,
    software,
    geokey,
    geoascii,
    geodouble,
    pixscale,
    tiepoint,
    stripOffsets,
    stripByteCounts,
    size: off
  }
}

function buildIFD(grid, compression, extrasAbs, layout, nextIFD) {
  const entries = [
    { tag: 256, type: 4, count: 1, value: grid.width }, // ImageWidth
    { tag: 257, type: 4, count: 1, value: grid.height }, // ImageLength
    { tag: 258, type: 3, count: 3, value: extrasAbs + layout.bits }, // BitsPerSample
    { tag: 259, type: 3, count: 1, value: compression === 'deflate' ? 8 : 1 }, // Compression
    { tag: 262, type: 3, count: 1, value: 2 }, // Photometric RGB
    { tag: 273, type: 4, count: grid.rows, value: extrasAbs + layout.stripOffsets }, // StripOffsets
    { tag: 277, type: 3, count: 1, value: 3 }, // SamplesPerPixel
    { tag: 278, type: 4, count: 1, value: TILE }, // RowsPerStrip
    { tag: 279, type: 4, count: grid.rows, value: extrasAbs + layout.stripByteCounts }, // StripByteCounts
    { tag: 284, type: 3, count: 1, value: 1 }, // PlanarConfiguration chunky
    { tag: 305, type: 2, count: SOFTWARE_LEN, value: extrasAbs + layout.software }, // Software
    { tag: 34735, type: 3, count: 24, value: extrasAbs + layout.geokey }, // GeoKeyDirectory (34735)
    { tag: 34736, type: 12, count: 0, value: 0 }, // GeoDoubleParams (34736，空)
    { tag: 34737, type: 2, count: 26, value: extrasAbs + layout.geoascii }, // GeoAsciiParams (34737)
    { tag: 33550, type: 12, count: 3, value: extrasAbs + layout.pixscale }, // ModelPixelScale (33550)
    { tag: 33922, type: 12, count: 6, value: extrasAbs + layout.tiepoint } // ModelTiepoint (33922)
  ].sort((a, b) => a.tag - b.tag) // TIFF 要求条目按 tag 升序

  const buf = Buffer.alloc(IFD_SIZE)
  let p = 0
  buf.writeUInt16LE(entries.length, p)
  p += 2
  for (const e of entries) {
    buf.writeUInt16LE(e.tag, p)
    p += 2
    buf.writeUInt16LE(e.type, p)
    p += 2
    buf.writeUInt32LE(e.count, p)
    p += 4
    buf.writeUInt32LE(e.value, p)
    p += 4
  }
  buf.writeUInt32LE(nextIFD, p)
  return buf
}

function buildExtras(grid, layout, stripOffsets, stripSizes) {
  const buf = Buffer.alloc(layout.size)
  // BitsPerSample = 8,8,8
  buf.writeUInt16LE(8, layout.bits)
  buf.writeUInt16LE(8, layout.bits + 2)
  buf.writeUInt16LE(8, layout.bits + 4)
  // Software
  buf.write(SOFTWARE, layout.software, 'ascii')
  // GeoKeyDirectory：Projected / PixelIsArea / EPSG:3857 / 米
  const gk = [
    1,
    1,
    0,
    5, // 版本
    1024,
    0,
    1,
    1, // GTModelTypeGeoKey = 1 (Projected)
    1025,
    0,
    1,
    1, // GTRasterTypeGeoKey = 1 (PixelIsArea)
    1026,
    34737,
    26,
    0, // GTCitationGeoKey -> GeoAsciiParams (34737)
    3072,
    0,
    1,
    3857, // ProjectedCSTypeGeoKey = 3857
    3076,
    0,
    1,
    9001 // ProjLinearUnitsGeoKey = 9001 (米)
  ]
  for (let i = 0; i < gk.length; i++)
    buf.writeUInt16LE(gk[i], layout.geokey + i * 2)
  // GeoAsciiParams
  buf.write('WGS 84 / Pseudo-Mercator', layout.geoascii, 'ascii')
  // ModelPixelScale（ScaleY 用正值，按 GeoTIFF 规范表示“J 增大时 Y 减小”，即北朝上）
  buf.writeDoubleLE(grid.res, layout.pixscale)
  buf.writeDoubleLE(grid.res, layout.pixscale + 8)
  buf.writeDoubleLE(0, layout.pixscale + 16)
  // ModelTiepoint
  buf.writeDoubleLE(0, layout.tiepoint)
  buf.writeDoubleLE(0, layout.tiepoint + 8)
  buf.writeDoubleLE(0, layout.tiepoint + 16)
  buf.writeDoubleLE(grid.originX, layout.tiepoint + 24)
  buf.writeDoubleLE(grid.originY, layout.tiepoint + 32)
  buf.writeDoubleLE(0, layout.tiepoint + 40)
  // StripOffsets / StripByteCounts
  for (let i = 0; i < stripOffsets.length; i++)
    buf.writeUInt32LE(stripOffsets[i], layout.stripOffsets + i * 4)
  for (let i = 0; i < stripSizes.length; i++)
    buf.writeUInt32LE(stripSizes[i], layout.stripByteCounts + i * 4)
  return buf
}

function compress(band, method) {
  return method === 'deflate' ? deflateSync(band, { level: 6 }) : band
}

/* ===================== 写入 GeoTIFF ===================== */
function writeGeoTIFF(outPath, db, layers) {
  const fd = fs.openSync(outPath, 'w')
  try {
    let pos = 0
    // 头占位（8 字节）
    fs.writeSync(fd, Buffer.alloc(8), 0, 8, 0)
    pos = 8

    const infos = []
    for (const layer of layers) {
      const N = layer.grid.rows // 一个 strip = 一行瓦片
      const layout = extrasLayout(N)
      const ifdOffset = pos
      fs.writeSync(fd, Buffer.alloc(IFD_SIZE), 0, IFD_SIZE, pos)
      pos += IFD_SIZE
      const extrasAbs = pos
      fs.writeSync(fd, Buffer.alloc(layout.size), 0, layout.size, pos)
      pos += layout.size

      const stripOffsets = []
      const stripSizes = []
      console.log(`📦 z${layer.z}: ${layer.grid.cols}×${layer.grid.rows} 瓦片 → ${layer.grid.width}×${layer.grid.height}px`)
      for (let s = 0; s < N; s++) {
        const band = buildStrip(db, layer.grid, layer.z, s)
        const data = compress(band, layer.compression)
        stripOffsets.push(pos)
        stripSizes.push(data.length)
        fs.writeSync(fd, data, 0, data.length, pos)
        pos += data.length
        if ((s + 1) % 10 === 0 || s === N - 1)
          process.stdout.write(`\r  strip ${s + 1}/${N} (${(pos / 1024 / 1024).toFixed(1)} MB)`)
      }
      console.log()
      infos.push({ layer, layout, ifdOffset, extrasAbs, stripOffsets, stripSizes })
    }

    // 回填文件头 → 指向第一个 IFD
    const hb = Buffer.alloc(8)
    hb.write('II', 0, 'ascii')
    hb.writeUInt16LE(42, 2)
    hb.writeUInt32LE(infos[0].ifdOffset, 4)
    fs.writeSync(fd, hb, 0, 8, 0)

    // 回填每个 IFD（含 extras 里的 strip 偏移/长度）
    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      const extrasBuf = buildExtras(
        info.layer.grid,
        info.layout,
        info.stripOffsets,
        info.stripSizes
      )
      fs.writeSync(fd, extrasBuf, 0, extrasBuf.length, info.extrasAbs)
      const nextIFD = i < infos.length - 1 ? infos[i + 1].ifdOffset : 0
      const ifdBuf = buildIFD(
        info.layer.grid,
        info.layer.compression,
        info.extrasAbs,
        info.layout,
        nextIFD
      )
      fs.writeSync(fd, ifdBuf, 0, ifdBuf.length, info.ifdOffset)
    }

    return pos
  }
  finally {
    fs.closeSync(fd)
  }
}

/* ===================== 校验 ===================== */
function readType(buf, isII, off, type) {
  const fn = isII
    ? {
        3: () => buf.readUInt16LE(off),
        4: () => buf.readUInt32LE(off),
        12: () => buf.readDoubleLE(off)
      }
    : {
        3: () => buf.readUInt16BE(off),
        4: () => buf.readUInt32BE(off),
        12: () => buf.readDoubleBE(off)
      }
  return fn[type]()
}

function parseIFD(buf, isII, ifdOff) {
  const cnt = isII ? buf.readUInt16LE(ifdOff) : buf.readUInt16BE(ifdOff)
  const tags = {}
  let nextIFD = 0
  for (let i = 0; i < cnt; i++) {
    const e = ifdOff + 2 + i * 12
    const tag = isII ? buf.readUInt16LE(e) : buf.readUInt16BE(e)
    const type = isII ? buf.readUInt16LE(e + 2) : buf.readUInt16BE(e + 2)
    const count = isII ? buf.readUInt32LE(e + 4) : buf.readUInt32BE(e + 4)
    const valueOff = isII ? buf.readUInt32LE(e + 8) : buf.readUInt32BE(e + 8)
    tags[tag] = { type, count, valueOff }
    if (tag === 273 || tag === 279) {
      const arr = []
      for (let k = 0; k < count; k++)
        arr.push(readType(buf, isII, valueOff + k * 4, 4))
      tags[tag].values = arr
    }
  }
  const nextOff = ifdOff + 2 + cnt * 12
  nextIFD = isII ? buf.readUInt32LE(nextOff) : buf.readUInt32BE(nextOff)
  return { tags, nextIFD }
}

function verifyTif(tifPath, db, layers) {
  const buf = fs.readFileSync(tifPath)
  const isII = buf.toString('ascii', 0, 2) === 'II'
  const magic = isII ? buf.readUInt16LE(2) : buf.readUInt16BE(2)
  if (magic !== 42)
    throw new Error('不是经典 TIFF（magic != 42）')
  const ifdOff = isII ? buf.readUInt32LE(4) : buf.readUInt32BE(4)

  console.log('🔎 校验 TIFF 结构...')
  let cur = ifdOff
  let layerIdx = 0
  while (cur) {
    const { tags, nextIFD } = parseIFD(buf, isII, cur)
    const width = tags[256].valueOff
    const height = tags[257].valueOff
    const comp = tags[259].valueOff
    const scale = tags[33550]
    const res = readType(buf, isII, scale.valueOff, 12)
    console.log(
      `  IFD#${layerIdx}: ${width}×${height}px, compression=${comp}, res=${res.toFixed(3)}m/px`
    )
    layerIdx++
    cur = nextIFD
  }
  if (layerIdx !== layers.length)
    throw new Error(`IFD 数量不符：${layerIdx} != ${layers.length}`)

  // 用第一层（主图）的第一个 strip 左上角像素与源 mbtiles 对比
  const main = layers[0]
  const { tags } = parseIFD(buf, isII, ifdOff)
  const off = tags[273].values[0]
  const cnt = tags[279].values[0]
  const comp = tags[259].valueOff
  let strip = buf.subarray(off, off + cnt)
  if (comp === 8)
    strip = inflateSync(strip)
  const px0 = [strip[0], strip[1], strip[2]] // 左上角 RGB
  const px1 = [strip[10 * 3], strip[10 * 3 + 1], strip[10 * 3 + 2]]

  const y0 = main.grid.minY
  const x0 = main.grid.minX
  const stmt = db.prepare(
    'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
  )
  const row = stmt.get(main.z, x0, tmsY(y0, main.z))
  if (!row?.tile_data) {
    console.log('  ⚠️ 源 mbtiles 缺失左上角瓦片，跳过像素对比')
    return
  }
  const px = decodeTile(row.tile_data)
  const exp0 = [px.data[0], px.data[1], px.data[2]]
  const exp1 = [px.data[10 * 4], px.data[10 * 4 + 1], px.data[10 * 4 + 2]]
  const same = px0.every((v, i) => v === exp0[i])
    && px1.every((v, i) => v === exp1[i])
  console.log(`  左上角像素: tif=${px0.join(',')} src=${exp0.join(',')} ${same ? '✅' : '❌'}`)
  console.log(`  (10,10)像素: tif=${px1.join(',')} src=${exp1.join(',')}`)
  if (!same)
    throw new Error('TIFF 首 strip 像素与源数据不一致！')
  console.log('✅ 校验通过')
}

/* ===================== 主流程 ===================== */
function main() {
  const args = parseArgs()
  if (!args.mbtiles) {
    console.error('❌ 缺少 --mbtiles 参数')
    console.error('  用法: node ./src/maptiles-to-tif.mjs --mbtiles=xxx.mbtiles [--out=xx.tif] [--zoom=13,14] [--bbox=w,s,e,n] [--compression=deflate|none] [--verify]')
    process.exit(1)
  }

  const db = new Database(args.mbtiles, { readonly: true })
  try {
    const meta = readMetadata(db)
    console.log('📄 元数据:', JSON.stringify(meta))

    let bounds = meta.bounds
    if (args.bbox) {
      const b = args.bbox.split(',').map(Number)
      if (b.length !== 4)
        throw new Error('--bbox 需要 4 个数字: w,s,e,n')
      bounds = b
    }

    // 默认层级：只取最高 zoom 作为单张主图（最通用）；
    // 用 --zoom=14,13 可把低 zoom 作为 overview 一并写入同一文件（多 IFD）。
    let zooms
    if (args.zoom) {
      zooms = String(args.zoom).split(',').map(Number).filter(Number.isFinite)
    }
    else {
      zooms = [meta.maxzoom]
    }

    const compression = args.compression === 'none' ? 'none' : 'deflate'
    const layers = zooms.map((z, i) => ({
      z,
      grid: computeGrid(bounds, z),
      compression,
      isMain: i === 0
    }))

    const outPath = args.out ?? args.mbtiles.replace(/\.mbtiles$/i, '.tif')
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })

    console.time('merge')
    const size = writeGeoTIFF(outPath, db, layers)
    console.timeEnd('merge')
    console.log(`✅ 已生成 ${outPath} (${(size / 1024 / 1024).toFixed(1)} MB)`)

    if (args.verify)
      verifyTif(outPath, db, layers)
  }
  finally {
    db.close()
  }
}

main()
