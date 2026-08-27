#!/usr/bin/env node
/**
 * MBTiles 区域瓦片提取工具
 *
 * 从一个 (通常是全球的) MBTiles 中，按 bbox 范围 + zoom 范围提取瓦片：
 *   - 输出为新的 MBTiles（保留原 schema + 更新后的 metadata）
 *   - 或输出为散列瓦片文件目录 {z}/{x}/{y}.{ext}（如 .png / .pbf / .mvt）
 *
 * 用法:
 *   node extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6
 *   node extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --min-z 0 --max-z 12
 *   node extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --mbtiles ./output/region.mbtiles
 *   node extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --dir ./output/region_tiles
 *
 * 说明:
 *   - 源 MBTiles 的 tile_row 按 TMS 约定（y 翻转）；散列输出按 XYZ 约定（y 不翻转，便于直接供瓦片服务器使用）
 *   - 扩展名按源 metadata.format 自动识别：png/jpg/webp/pbf/mvt，未知则按魔数探测
 *   - 只提取与 bbox 相交的瓦片（边界瓦片整体保留）
 */
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** 项目根目录（scripts 的上一级），相对路径统一以它为基准 */
const PROJECT_ROOT = path.resolve(__dirname, '..')

/**
 * MBTiles tiles 表的一行
 * @typedef {{ zoom_level: number, tile_column: number, tile_row: number, tile_data: Buffer }} TileRow
 */

/* ===================== 参数解析 ===================== */
// 布尔开关（无值）参数
const FLAGS = new Set(['debug', 'force'])

/**
 * @returns {Record<string, string | boolean>} 解析后的命令行参数表
 */
function parseArgs() {
  const args = process.argv.slice(2)
  /** @type {Record<string, string | boolean>} */
  const params = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const key = eq >= 0 ? a.slice(2, eq) : a.slice(2)
      if (eq >= 0) {
        params[key] = a.slice(eq + 1)
      }
      else if (FLAGS.has(key)) {
        params[key] = true
      }
      else {
        params[key] = args[++i]
        if (params[key] === undefined)
          throw new Error(`Missing value for --${key}`)
      }
    }
  }
  return params
}

const USAGE = `
用法:
  node extract-tiles.mjs --bbox <minLon,minLat,maxLon,maxLat> [options]

必选:
  --bbox <a,b,c,d>      提取范围: 最小经度,最小纬度,最大经度,最大纬度

可选:
  --src <path>          源 MBTiles (默认: ./output/amazonaws_ter_world_0_12.mbtiles)
  --min-z <z>           最小缩放级 (默认: 源 minzoom)
  --max-z <z>           最大缩放级 (默认: 源 maxzoom)
  --mbtiles <path>      输出为新的 MBTiles 文件 (与 --dir 二选一, 默认)
  --dir <path>          输出为散列瓦片目录 {z}/{x}/{y}.{ext}
  --force               覆盖已存在的输出文件
  --debug               输出调试日志

示例:
  node extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6
  node extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --min-z 6 --max-z 12 \\
    --mbtiles ./output/region.mbtiles
  node extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --dir ./output/region_tiles
`

const params = parseArgs()

const bboxStr = params.bbox
if (typeof bboxStr !== 'string' || bboxStr.length === 0) {
  console.error(USAGE)
  process.exit(1)
}

const bbox = bboxStr.split(',').map(Number)
if (bbox.length !== 4 || bbox.some(n => !Number.isFinite(n))) {
  console.error('❌ --bbox 格式错误，应为: minLon,minLat,maxLon,maxLat')
  process.exit(1)
}
if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
  console.error('❌ --bbox 范围无效: 需 minLon<maxLon 且 minLat<maxLat')
  process.exit(1)
}

const SRC = typeof params.src === 'string' ? params.src : './output/amazonaws_ter_world_0_12.mbtiles'
const SRC_ABS = path.isAbsolute(SRC) ? SRC : path.resolve(PROJECT_ROOT, SRC)

let outMbtiles = null
if (typeof params.mbtiles === 'string') {
  outMbtiles = path.isAbsolute(params.mbtiles) ? params.mbtiles : path.resolve(PROJECT_ROOT, params.mbtiles)
}
const outDir = typeof params.dir === 'string'
  ? (path.isAbsolute(params.dir) ? params.dir : path.resolve(PROJECT_ROOT, params.dir))
  : null

if (outMbtiles && outDir) {
  console.error('❌ --mbtiles 与 --dir 只能选其一')
  process.exit(1)
}
if (!outMbtiles && !outDir) {
  // 默认输出为 mbtiles，放在源同目录下
  const srcBase = path.basename(SRC_ABS, path.extname(SRC_ABS))
  outMbtiles = path.join(path.dirname(SRC_ABS), `${srcBase}_extract.mbtiles`)
}

const force = params.force === true
const debug = params.debug === true

/* ===================== WebMercator / TMS ===================== */
/**
 * @param {number} lon
 * @param {number} lat
 * @param {number} z
 * @returns {{ x: number, y: number }} XYZ 瓦片坐标
 */
function lonLatToTileXY(lon, lat, z) {
  const n = 2 ** z
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor(
    (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI)
    / 2 * n
  )
  return { x, y }
}

/**
 * bbox → XYZ 瓦片范围（含边界相交瓦片，并夹取到有效范围）
 * @param {number[]} b
 * @param {number} z
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }} XYZ 瓦片范围
 */
function bboxToTileRange(b, z) {
  const n = 2 ** z
  const tN = lonLatToTileXY(b[0], b[3], z) // minLon, maxLat → 左上
  const tS = lonLatToTileXY(b[2], b[1], z) // maxLon, minLat → 右下
  return {
    minX: Math.max(0, Math.min(tN.x, tS.x)),
    maxX: Math.min(n - 1, Math.max(tN.x, tS.x)),
    minY: Math.max(0, Math.min(tN.y, tS.y)),
    maxY: Math.min(n - 1, Math.max(tN.y, tS.y))
  }
}

/**
 * XYZ y → TMS row（MBTiles 存储约定）
 * @param {number} y
 * @param {number} z
 * @returns {number} TMS 行号
 */
function tmsY(y, z) {
  return (1 << z) - 1 - y
}

/* ===================== 工具 ===================== */
/**
 * @param {string} p
 */
function ensureWritable(p) {
  if (fs.existsSync(p) && !force) {
    console.error(`❌ 输出已存在: ${p} (使用 --force 覆盖)`)
    process.exit(1)
  }
}

/**
 * 依据 metadata.format + 魔数判断散列文件扩展名
 * @param {import('better-sqlite3').Database} srcDb
 * @param {Buffer | undefined} sample
 * @returns {string} 散列文件扩展名
 */
function detectExt(srcDb, sample) {
  const fmtRow = /** @type {{ value?: unknown } | undefined} */ (
    srcDb.prepare('SELECT value FROM metadata WHERE name=\'format\'').get()
  )
  const fmt = fmtRow?.value !== undefined ? String(fmtRow.value) : ''
  /** @type {Record<string, string>} */
  const known = {
    'png': 'png',
    'jpg': 'jpg',
    'jpeg': 'jpg',
    'webp': 'webp',
    'pbf': 'pbf',
    'mvt': 'mvt',
    'mapbox-vector': 'pbf',
    'protobuf': 'pbf'
  }
  if (fmt && known[fmt])
    return known[fmt]
  // 魔数探测
  if (sample) {
    const h = sample.subarray(0, 8)
    if (h.equals(Buffer.from([0x89, 0x50, 0x4E, 0x47])))
      return 'png'
    if (h[0] === 0xFF && h[1] === 0xD8)
      return 'jpg'
    if (h[0] === 0x1F && h[1] === 0x8B)
      return 'pbf.gz'
    if (h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP')
      return 'webp'
    if (h[0] === 0x1A && h[1] === 0x0B)
      return 'mvt' // MVT magic
  }
  return 'bin'
}

/**
 * @param {import('better-sqlite3').Database} srcDb
 * @returns {Record<string, string>} metadata 键值对
 */
function readMeta(srcDb) {
  const rows = srcDb.prepare('SELECT name, value FROM metadata').all()
  /** @type {Record<string, string>} */
  const m = {}
  for (const r of rows) {
    const row = /** @type {{ name: string, value: string }} */ (r)
    m[row.name] = row.value
  }
  return m
}

/**
 * @param {number} n
 * @returns {string} 格式化后的数字字符串
 */
function fmtCount(n) {
  return n.toLocaleString('en-US')
}

/* ===================== 主流程 ===================== */
console.log('📦 源文件:', SRC_ABS)
if (!fs.existsSync(SRC_ABS)) {
  console.error('❌ 源 MBTiles 不存在')
  process.exit(1)
}

const srcDb = new Database(SRC_ABS, { readonly: true })
srcDb.pragma('cache_size = -200000')
srcDb.pragma('temp_store = MEMORY')

const srcMeta = readMeta(srcDb)
const srcMinZ = Number.parseInt(srcMeta.minzoom ?? '0', 10)
const srcMaxZ = Number.parseInt(srcMeta.maxzoom ?? '0', 10)

const minZ = typeof params['min-z'] === 'string' ? Number.parseInt(params['min-z'], 10) : srcMinZ
const maxZ = typeof params['max-z'] === 'string' ? Number.parseInt(params['max-z'], 10) : srcMaxZ
if (!Number.isInteger(minZ) || !Number.isInteger(maxZ) || minZ < srcMinZ || maxZ > srcMaxZ || minZ > maxZ) {
  console.error(`❌ zoom 范围无效 (源: ${srcMinZ}-${srcMaxZ})`)
  process.exit(1)
}

const sampleRow = /** @type {{ tile_data?: Buffer } | undefined} */ (
  srcDb.prepare('SELECT tile_data FROM tiles LIMIT 1').get()
)
const ext = detectExt(srcDb, sampleRow?.tile_data)
console.log(`🗺️  bbox: ${bbox.join(', ')}  |  zoom: ${minZ} - ${maxZ}`)
console.log(`🏷️  源格式: ${srcMeta.format ?? '?'}  → 散列扩展名: .${ext}`)

/* ---- 预估各层级瓦片数 ---- */
let totalEstimate = 0
/** @type {Record<number, { minX: number, maxX: number, minY: number, maxY: number, count: number }>} */
const ranges = {}
for (let z = minZ; z <= maxZ; z++) {
  const r = bboxToTileRange(bbox, z)
  const count = (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1)
  ranges[z] = { ...r, count }
  totalEstimate += count
  if (debug)
    console.log(`  z${z}: x[${r.minX}-${r.maxX}] y[${r.minY}-${r.maxY}] ≈ ${fmtCount(count)} tiles`)
}
console.log(`📐 预计瓦片总数: ${fmtCount(totalEstimate)} (含边界整瓦)`)

const start = Date.now()

/* ---- 模式 A: 输出为 MBTiles ---- */
if (outMbtiles) {
  ensureWritable(outMbtiles)
  fs.mkdirSync(path.dirname(outMbtiles), { recursive: true })
  const dstDb = new Database(outMbtiles)
  dstDb.pragma('journal_mode = WAL')
  dstDb.pragma('synchronous = OFF')
  dstDb.pragma('temp_store = MEMORY')
  dstDb.pragma('cache_size = -200000')

  dstDb.exec(`
    CREATE TABLE tiles (
      zoom_level INTEGER,
      tile_column INTEGER,
      tile_row INTEGER,
      tile_data BLOB
    );
    CREATE UNIQUE INDEX tile_idx ON tiles (zoom_level, tile_column, tile_row);
  `)
  dstDb.exec('CREATE TABLE metadata (name TEXT, value TEXT);')

  const insert = dstDb.prepare(`
    INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data)
    VALUES (?, ?, ?, ?)
  `)
  const selectRange = srcDb.prepare(`
    SELECT zoom_level, tile_column, tile_row, tile_data
    FROM tiles
    WHERE zoom_level = ? AND tile_column BETWEEN ? AND ? AND tile_row BETWEEN ? AND ?
  `)

  let copied = 0
  let missing = 0
  const tx = dstDb.transaction(() => {
    for (let z = minZ; z <= maxZ; z++) {
      const r = ranges[z]
      const minTY = tmsY(r.maxY, z)
      const maxTY = tmsY(r.minY, z)
      const rangeCount = r.count
      let inRange = 0
      for (const raw of selectRange.iterate(z, r.minX, r.maxX, minTY, maxTY)) {
        const row = /** @type {TileRow} */ (raw)
        if (row.tile_data && row.tile_data.length > 0) {
          insert.run(row.zoom_level, row.tile_column, row.tile_row, row.tile_data)
          copied++
        }
        else {
          missing++
        }
        inRange++
      }
      const have = copied
      console.log(`  ✅ z${z}: ${fmtCount(rangeCount)} 范围内, 已写入 ${fmtCount(inRange)} 瓦片 (累计 ${fmtCount(have)})`)
    }
  })
  tx()

  // metadata
  const center = `${((bbox[0] + bbox[2]) / 2).toFixed(6)},${((bbox[1] + bbox[3]) / 2).toFixed(6)},${Math.floor((minZ + maxZ) / 2)}`
  const meta = {
    name: `${srcMeta.name ?? 'Tiles'} (extract)`,
    format: srcMeta.format ?? ext,
    minzoom: String(minZ),
    maxzoom: String(maxZ),
    bounds: bbox.join(','),
    center,
    type: srcMeta.type ?? 'overlay',
    attribution: srcMeta.attribution ?? ''
  }
  const stmt = dstDb.prepare('INSERT INTO metadata (name, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(meta)) stmt.run(k, v)

  const countRow = /** @type {{ c: number }} */ (dstDb.prepare('SELECT COUNT(*) AS c FROM tiles').get())
  const actual = countRow.c
  dstDb.close()

  const secs = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ 已生成 MBTiles: ${outMbtiles}`)
  console.log(`   实际瓦片数: ${fmtCount(actual)}  |  跳过空瓦片: ${fmtCount(missing)}  |  耗时: ${secs}s`)
}

/* ---- 模式 B: 输出为散列瓦片目录 {z}/{x}/{y}.{ext} ---- */
else if (outDir) {
  ensureWritable(outDir)
  fs.mkdirSync(outDir, { recursive: true })

  const selectRange = srcDb.prepare(`
    SELECT zoom_level, tile_column, tile_row, tile_data
    FROM tiles
    WHERE zoom_level = ? AND tile_column BETWEEN ? AND ? AND tile_row BETWEEN ? AND ?
  `)

  let copied = 0
  let missing = 0
  for (let z = minZ; z <= maxZ; z++) {
    const r = ranges[z]
    const minTY = tmsY(r.maxY, z)
    const maxTY = tmsY(r.minY, z)
    const zd = path.join(outDir, String(z))
    fs.mkdirSync(zd, { recursive: true })

    // 预创建 x 目录，减少重复 mkdir
    const xDirs = new Set()
    for (let x = r.minX; x <= r.maxX; x++) {
      const xd = path.join(zd, String(x))
      if (!xDirs.has(xd)) {
        fs.mkdirSync(xd, { recursive: true })
        xDirs.add(xd)
      }
    }

    for (const raw of selectRange.iterate(z, r.minX, r.maxX, minTY, maxTY)) {
      const row = /** @type {TileRow} */ (raw)
      if (!row.tile_data || row.tile_data.length === 0) {
        missing++
        continue
      }
      const x = row.tile_column
      const y = (1 << z) - 1 - row.tile_row // TMS → XYZ
      const file = path.join(zd, String(x), `${y}.${ext}`)
      fs.writeFileSync(file, row.tile_data)
      copied++
    }
    console.log(`  ✅ z${z}: 范围内 ${fmtCount(r.count)}, 已写入 ${fmtCount(copied)} (累计)`)
  }

  const secs = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ 已生成散列瓦片目录: ${outDir}`)
  console.log(`   实际瓦片数: ${fmtCount(copied)}  |  跳过空瓦片: ${fmtCount(missing)}  |  耗时: ${secs}s`)
  console.log(`   目录结构: {z}/{x}/{y}.${ext}`)
}

srcDb.close()
