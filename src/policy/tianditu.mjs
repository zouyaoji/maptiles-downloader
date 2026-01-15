import { Buffer } from 'node:buffer'

const tk = '9c2687900fc66ce8106c570f3e321439'

/**
 * 天地图 · 矢量底图（vec）
 * World 维度
 */
export const tiandituVecPolicyWorld = {
  name: 'Tianditu Street Map World (0-12)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  // 👉 下载层级（强烈建议分批）
  levels: [
    ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 0–12 全球
    // ...Array.from({ length: 4 }, (_, i) => ({
    //   z: 13 + i,
    //   bbox: [73, 3, 135, 54]
    // })), // 国家级重点 13-16
    // { z: 17, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
    // { z: 18, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 17-18
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_vec_w_world_0_12.mbtiles',
    progressFile: './output/tianditu_vec_w_world_0_12.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 100, //
    maxRetry: 3,
    mbBatchSize: 50 // 小批量，避免 WAL 堆积
  },

  /**
   * WMTS Tile URL
   */
  getTileUrl(z, x, y, i) {
    if (!tk)
      throw new Error('❌ missing TIANDITU_TK')

    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://${sub}.tianditu.gov.cn/vec_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=vec'
      + '&STYLE=default'
      + '&TILEMATRIXSET=w'
      + `&TILEMATRIX=${z}`
      + `&TILEROW=${y}`
      + `&TILECOL=${x}`
      + '&FORMAT=tiles'
      + `&tk=${tk}`
    )
  },

  /**
   * fetch headers（非常关键）
   */
  requestHeaders: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    'Referer': 'https://www.tianditu.gov.cn/',
    'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5'
  },

  /**
   * PNG 校验
   */
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },

  /**
   * MBTiles metadata
   */
  generateMetadata(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (name TEXT,value TEXT);
      DELETE FROM metadata;
    `)

    const meta = {
      name: this.name,
      format: 'png',
      minzoom: '0',
      maxzoom: '12',
      bounds: '-180,-85.0511,180,85.0511',
      center: '104,30,5',
      type: 'baselayer',
      attribution: '© 天地图'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 天地图 · 矢量底图（vec）
 * China 维度
 */
export const tiandituVecPolicyChina = {
  name: 'Tianditu Street Map China (13-16)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  // 👉 下载层级（强烈建议分批）
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 0–12 全球
    ...Array.from({ length: 4 }, (_, i) => ({
      z: 13 + i,
      bbox: [73, 3, 135, 54]
    })) // 国家级重点 13-16
    // { z: 17, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
    // { z: 18, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 17-18
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_vec_w_china_13_16.mbtiles',
    progressFile: './output/tianditu_vec_w_china_13_16.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 100, //
    maxRetry: 3,
    mbBatchSize: 50 // 小批量，避免 WAL 堆积
  },

  /**
   * WMTS Tile URL
   */
  getTileUrl(z, x, y, i) {
    if (!tk)
      throw new Error('❌ missing TIANDITU_TK')

    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://${sub}.tianditu.gov.cn/vec_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=vec'
      + '&STYLE=default'
      + '&TILEMATRIXSET=w'
      + `&TILEMATRIX=${z}`
      + `&TILEROW=${y}`
      + `&TILECOL=${x}`
      + '&FORMAT=tiles'
      + `&tk=${tk}`
    )
  },

  /**
   * fetch headers（非常关键）
   */
  requestHeaders: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    'Referer': 'https://www.tianditu.gov.cn/',
    'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5'
  },

  /**
   * PNG 校验
   */
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },

  /**
   * MBTiles metadata
   */
  generateMetadata(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (name TEXT,value TEXT);
      DELETE FROM metadata;
    `)

    const meta = {
      name: this.name,
      format: 'png',
      minzoom: '13',
      maxzoom: '16',
      bounds: '73,3,135,54',
      center: '104,30,13',
      type: 'baselayer',
      attribution: '© 天地图'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 天地图 · 矢量底图（vec）
 * Province 维度
 */
export const tiandituVecPolicyProvince = {
  name: 'Tianditu Street Map Guangxi (17-18)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  // 👉 下载层级（强烈建议分批）
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 0–12 全球
    // ...Array.from({ length: 4 }, (_, i) => ({
    //   z: 13 + i,
    //   bbox: [73, 3, 135, 54]
    // })) // 国家级重点 13-16
    { z: 17, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
    { z: 18, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 17-18
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_vec_w_china_17_18.mbtiles',
    progressFile: './output/tianditu_vec_w_china_17_18.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 100, //
    maxRetry: 3,
    mbBatchSize: 50 // 小批量，避免 WAL 堆积
  },

  /**
   * WMTS Tile URL
   */
  getTileUrl(z, x, y, i) {
    if (!tk)
      throw new Error('❌ missing TIANDITU_TK')

    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://${sub}.tianditu.gov.cn/vec_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=vec'
      + '&STYLE=default'
      + '&TILEMATRIXSET=w'
      + `&TILEMATRIX=${z}`
      + `&TILEROW=${y}`
      + `&TILECOL=${x}`
      + '&FORMAT=tiles'
      + `&tk=${tk}`
    )
  },

  /**
   * fetch headers（非常关键）
   */
  requestHeaders: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    'Referer': 'https://www.tianditu.gov.cn/',
    'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5'
  },

  /**
   * PNG 校验
   */
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },

  /**
   * MBTiles metadata
   */
  generateMetadata(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (name TEXT,value TEXT);
      DELETE FROM metadata;
    `)

    const meta = {
      name: this.name,
      format: 'png',
      minzoom: '17',
      maxzoom: '18',
      bounds: '104,20,112.5,26.5',
      center: '108.3664,22.8177,17',
      type: 'baselayer',
      attribution: '© 天地图'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}
