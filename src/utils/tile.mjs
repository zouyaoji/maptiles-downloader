/**
 * 将 XYZ 瓦片坐标转为 QuadKey
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string} QuadKey 字符串
 */
export function tileXYToQuadKey(x, y, z) {
  let q = ''
  for (let i = z; i > 0; i--) {
    let d = 0
    const m = 1 << (i - 1)
    if (x & m)
      d++
    if (y & m)
      d += 2
    q += d
  }
  return q
}
/**
 * 经纬度转 XYZ 瓦片坐标
 * @param {number} lon
 * @param {number} lat
 * @param {number} z
 * @returns {{ x: number, y: number }} 瓦片坐标
 */
export function lonLatToTileXY(lon, lat, z) {
  const s = Math.sin((lat * Math.PI) / 180)
  const n = 1 << z
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)
  }
}
/**
 * 由 bbox 计算瓦片行列范围
 * @param {[number, number, number, number]} b - [minLon, minLat, maxLon, maxLat]
 * @param {number} z
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }} 瓦片行列范围
 */
export function bboxToTileRange(b, z) {
  const a = lonLatToTileXY(b[0], b[3], z)
  const c = lonLatToTileXY(b[2], b[1], z)
  return { minX: a.x, maxX: c.x, minY: a.y, maxY: c.y }
}
/**
 * TMS Y 坐标转 XYZ
 * @param {number} y
 * @param {number} z
 * @returns {number} TMS Y 坐标
 */
export function tmsY(y, z) {
  return (1 << z) - 1 - y
}

/**
 * 计算某一层级的瓦片范围
 * @param {{ z: number, bbox?: [number, number, number, number] }} level
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }} 该层级瓦片范围
 */
export function computeTileRange(level) {
  const { z, bbox } = level
  if (!bbox) {
    const n = (1 << z) - 1
    return { minX: 0, maxX: n, minY: 0, maxY: n }
  }
  return bboxToTileRange(bbox, z)
}
