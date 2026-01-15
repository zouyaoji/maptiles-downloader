import Database from 'better-sqlite3'

/* ===================== 配置 ===================== */
const SRC = './tiles/msn.street.mbtiles'
const TARGET = './tiles/msn_street_china_13_16.mbtiles'

const levels = [
  //* ****** msn 街道图 开始 *******//
  // ...Array.from({ length: 13 }, (_, i) => ({ z: i })), // 全球 0-12

  ...Array.from({ length: 4 }, (_, i) => ({
    z: 13 + i,
    bbox: [73, 3, 135, 54]
  })) // 国家级重点 13-16
  //   { z: 13, bbox: [73, 3, 135, 54] },
  //   { z: 14, bbox: [73, 3, 135, 54] },
  //   { z: 15, bbox: [73, 3, 135, 54] },
  //   { z: 16, bbox: [73, 3, 135, 54] },
  //* ****** msn 街道图 结束 *******//
]

/* ===================== WebMercator ===================== */
function lonLatToTile(lon, lat, z) {
  const n = 2 ** z
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor(
    ((1
      - Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      )
      / Math.PI)
    / 2)
  * n
  )
  return { x, y }
}

function tmsY(y, z) {
  return (1 << z) - 1 - y
}

function bboxToTileRange(bbox, z) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const t1 = lonLatToTile(minLon, maxLat, z)
  const t2 = lonLatToTile(maxLon, minLat, z)

  return {
    minX: Math.min(t1.x, t2.x),
    maxX: Math.max(t1.x, t2.x),
    minY: Math.min(t1.y, t2.y),
    maxY: Math.max(t1.y, t2.y)
  }
}

function writeMetadata(db, levels, opt = {}) {
  const minzoom = Math.min(...levels.map(l => l.z))
  const maxzoom = Math.max(...levels.map(l => l.z))

  const bounds = (() => {
    let hasBBox = false
    let minLon = 180
    let minLat = 90
    let maxLon = -180
    let maxLat = -90

    for (const l of levels) {
      if (!l.bbox)
        continue
      hasBBox = true
      const [a, b, c, d] = l.bbox
      minLon = Math.min(minLon, a)
      minLat = Math.min(minLat, b)
      maxLon = Math.max(maxLon, c)
      maxLat = Math.max(maxLat, d)
    }

    return hasBBox
      ? [minLon, minLat, maxLon, maxLat]
      : [-180, -85.0511, 180, 85.0511]
  })()

  const center = [
    ((bounds[0] + bounds[2]) / 2).toFixed(6),
    ((bounds[1] + bounds[3]) / 2).toFixed(6),
    Math.floor((minzoom + maxzoom) / 2)
  ].join(',')

  const meta = {
    name: opt.name ?? 'MSN Street Map',
    format: opt.format ?? 'png',
    minzoom: String(minzoom),
    maxzoom: String(maxzoom),
    bounds: bounds.join(','),
    center,
    type: opt.type ?? 'overlay',
    attribution: opt.attribution ?? '© Bing Maps'
  }

  db.exec(`
    DELETE FROM metadata;
    CREATE TABLE IF NOT EXISTS metadata (name TEXT, value TEXT);
  `)

  const stmt = db.prepare(`INSERT INTO metadata (name, value) VALUES (?, ?)`)
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(meta)) {
      stmt.run(k, v)
    }
  })
  tx()

  console.log('🧾 metadata written:', meta)
}

/* ===================== 打开数据库 ===================== */
const src = new Database(SRC, { readonly: true })
const dst = new Database(TARGET)

for (const db of [src, dst]) {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = OFF')
  db.pragma('temp_store = MEMORY')
  db.pragma('cache_size = -200000')
}

/* ===================== 初始化目标库 ===================== */
dst.exec(`
CREATE TABLE IF NOT EXISTS tiles (
  zoom_level INTEGER,
  tile_column INTEGER,
  tile_row INTEGER,
  tile_data BLOB
);
CREATE UNIQUE INDEX IF NOT EXISTS tile_idx
ON tiles (zoom_level, tile_column, tile_row);
`)

dst.exec(`
CREATE TABLE IF NOT EXISTS metadata (
  name TEXT,
  value TEXT
);
`)

/* ===================== 准备语句 ===================== */
const insert = dst.prepare(`
INSERT OR IGNORE INTO tiles
(zoom_level, tile_column, tile_row, tile_data)
VALUES (?, ?, ?, ?)
`)

const selectGlobal = src.prepare(`
SELECT zoom_level, tile_column, tile_row, tile_data
FROM tiles
WHERE zoom_level = ?
`)

const selectBBox = src.prepare(`
SELECT zoom_level, tile_column, tile_row, tile_data
FROM tiles
WHERE zoom_level = ?
  AND tile_column BETWEEN ? AND ?
  AND tile_row BETWEEN ? AND ?
`)

/* ===================== 执行拆分 ===================== */
console.time('split')

const tx = dst.transaction(() => {
  for (const lvl of levels) {
    if (!lvl.bbox) {
      // 全球
      for (const row of selectGlobal.iterate(lvl.z)) {
        insert.run(
          row.zoom_level,
          row.tile_column,
          row.tile_row,
          row.tile_data
        )
      }
    }
    else {
      // bbox 裁剪
      const r = bboxToTileRange(lvl.bbox, lvl.z)
      const minTY = tmsY(r.maxY, lvl.z)
      const maxTY = tmsY(r.minY, lvl.z)

      for (const row of selectBBox.iterate(
        lvl.z,
        r.minX,
        r.maxX,
        minTY,
        maxTY
      )) {
        insert.run(
          row.zoom_level,
          row.tile_column,
          row.tile_row,
          row.tile_data
        )
      }
    }
    console.log(`✅ z${lvl.z} done`)
  }
})

tx()

console.timeEnd('split')

writeMetadata(dst, levels, {
  name: 'MSN Street Map China(13-16)',
  type: 'overlay'
})

/* ===================== 校验 ===================== */
const countDst = dst.prepare('SELECT COUNT(*) AS c FROM tiles').get().c

console.log('DST tiles:', countDst)

/* ===================== 关闭 ===================== */
src.close()
dst.close()
