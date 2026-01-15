export function tileXYToQuadKey(x, y, z) {
  let q = '';
  for (let i = z; i > 0; i--) {
    let d = 0;
    const m = 1 << (i - 1);
    if (x & m) d++;
    if (y & m) d += 2;
    q += d;
  }
  return q;
}
export function lonLatToTileXY(lon, lat, z) {
  const s = Math.sin((lat * Math.PI) / 180);
  const n = 1 << z;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n),
  };
}
export function bboxToTileRange(b, z) {
  const a = lonLatToTileXY(b[0], b[3], z);
  const c = lonLatToTileXY(b[2], b[1], z);
  return { minX: a.x, maxX: c.x, minY: a.y, maxY: c.y };
}
export function tmsY(y, z) {
  return (1 << z) - 1 - y;
}

export function computeTileRange(level) {
  const { z, bbox } = level;
  if (!bbox) {
    const n = (1 << z) - 1;
    return { minX: 0, maxX: n, minY: 0, maxY: n };
  }
  return bboxToTileRange(bbox, z);
}
