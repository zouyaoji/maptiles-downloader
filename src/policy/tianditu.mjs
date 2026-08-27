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
    delay: 10, //
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
    concurrency: 2, // ❗ 天地图必须单线程
    delay: 10, //
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
    mbtilesFile: './output/tianditu_vec_w_guangxi_17_18.mbtiles',
    progressFile: './output/tianditu_vec_w_guangxi_17_18.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 10, //
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

/**
 * 天地图 · 影像底图（img）
 * World 维度
 */
export const tiandituImgPolicyWorld = {
  name: 'Tianditu Image Map World (0-12)',
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
    mbtilesFile: './output/tianditu_img_w_world_0_12.mbtiles',
    progressFile: './output/tianditu_img_w_world_0_12.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 10, //
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
      `https://${sub}.tianditu.gov.cn/img_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=img'
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
   * PNG/JPEG 校验
   */
  validateTile(buf) {
    if (!buf || buf.length < 4)
      return false
    // PNG 文件头
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return true
    }
    // JPEG 文件头
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return true
    }
    return false
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
 * 天地图 · 影像底图（img）
 * China 维度
 */
export const tiandituImgPolicyChina = {
  name: 'Tianditu Image Map China (13-15)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  // 👉 下载层级（强烈建议分批）
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
    { z: 13, bbox: [73, 3, 135, 54] },
    { z: 14, bbox: [73, 3, 135, 54] }, // 国家级重点 13-14
    { z: 15, bbox: [73, 3, 135, 54] }
    // { z: 16, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 15-16
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_img_w_china_13_15.mbtiles',
    progressFile: './output/tianditu_img_w_china_13_15.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 10, //
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
      `https://${sub}.tianditu.gov.cn/img_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=img'
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
   * PNG/JPEG 校验
   */
  validateTile(buf) {
    if (!buf || buf.length < 4)
      return false
    // PNG 文件头
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return true
    }
    // JPEG 文件头
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return true
    }
    return false
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
      maxzoom: '15',
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
 * 天地图 · 影像底图（img）
 * Shaoguan 维度（12 层）——与 Bing 不同的影像数据源，时相可能不同，可用作有云区域的备选
 * bbox 与 MSN 韶关一致（bounds/韶关.geojson 外扩 0.2°）
 */
export const tiandituImgPolicyShaoguan = {
  name: 'Tianditu Image Map Shaoguan (12)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  levels: [
    {
      z: 12,
      bbox: [112.64654694000005, 23.689888519000068, 114.94473159000002, 25.71997878800006]
    }
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_img_w_shaoguan_12.mbtiles',
    progressFile: './output/tianditu_img_w_shaoguan_12.progress.json',
    concurrency: 3, // 天地图并发不宜太高，此处按需改成 3 线程
    delay: 10,
    maxRetry: 3,
    mbBatchSize: 50 // 小批量，避免 WAL 堆积
  },

  getTileUrl(z, x, y, i) {
    if (!tk)
      throw new Error('❌ missing TIANDITU_TK')

    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://${sub}.tianditu.gov.cn/img_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=img'
      + '&STYLE=default'
      + '&TILEMATRIXSET=w'
      + `&TILEMATRIX=${z}`
      + `&TILEROW=${y}`
      + `&TILECOL=${x}`
      + '&FORMAT=tiles'
      + `&tk=${tk}`
    )
  },

  requestHeaders: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    'Referer': 'https://www.tianditu.gov.cn/',
    'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5'
  },

  validateTile(buf) {
    if (!buf || buf.length < 4)
      return false
    // PNG 文件头
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])))
      return true
    // JPEG 文件头
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF)
      return true
    return false
  },

  generateMetadata(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (name TEXT,value TEXT);
      DELETE FROM metadata;
    `)

    const meta = {
      name: this.name,
      format: 'jpg',
      minzoom: '12',
      maxzoom: '12',
      bounds: '112.64654694000005,23.689888519000068,114.94473159000002,25.71997878800006',
      center: '113.79563926500004,24.704933653500066,12',
      type: 'baselayer',
      attribution: '© 天地图'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 天地图 · 影像底图（img）
 * Province 维度
 */
export const tiandituImgPolicyProvince = {
  name: 'Tianditu Image Map Guangxi (15-18)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  // 👉 下载层级（强烈建议分批）
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
    // { z: 13, bbox: [73, 3, 135, 54] },
    // { z: 14, bbox: [73, 3, 135, 54] } // 国家级重点 13-14
    { z: 15, bbox: [104, 20, 112.5, 26.5] },
    { z: 16, bbox: [104, 20, 112.5, 26.5] },
    { z: 17, bbox: [104, 20, 112.5, 26.5] },
    { z: 18, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 15-18
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_img_w_guangxi_15_18.mbtiles',
    progressFile: './output/tianditu_img_w_guangxi_15_18.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 10, //
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
      `https://${sub}.tianditu.gov.cn/img_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=img'
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
   * PNG/JPEG 校验
   */
  validateTile(buf) {
    if (!buf || buf.length < 4)
      return false
    // PNG 文件头
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return true
    }
    // JPEG 文件头
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return true
    }
    return false
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
      minzoom: '15',
      maxzoom: '18',
      bounds: '104,20,112.5,26.5',
      center: '108.3664,22.8177,15',
      type: 'baselayer',
      attribution: '© 天地图'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 天地图 · 地形底图（ter）
 * World 维度
 */
export const tiandituTerPolicyWorld = {
  name: 'Tianditu Terrain Map World (0-12)',
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
    mbtilesFile: './output/tianditu_ter_w_world_0_12.mbtiles',
    progressFile: './output/tianditu_ter_w_world_0_12.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 10, //
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
      `https://${sub}.tianditu.gov.cn/ter_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=ter'
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
   * PNG/JPEG 校验
   */
  validateTile(buf) {
    if (!buf || buf.length < 4)
      return false
    // PNG 文件头
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return true
    }
    // JPEG 文件头
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return true
    }
    return false
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
 * 天地图 · 地形底图（ter）
 * China 维度
 */
export const tiandituTerPolicyChina = {
  name: 'Tianditu Terrain Map China (13-14)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  // 👉 下载层级（强烈建议分批）
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
    { z: 13, bbox: [73, 3, 135, 54] },
    { z: 14, bbox: [73, 3, 135, 54] } // 国家级重点 13-14
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_ter_w_china_13_14.mbtiles',
    progressFile: './output/tianditu_ter_w_china_13_14.progress.json',
    concurrency: 1, // ❗ 天地图必须单线程
    delay: 5, //
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
      `https://${sub}.tianditu.gov.cn/ter_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=ter'
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
   * PNG/JPEG 校验
   */
  validateTile(buf) {
    if (!buf || buf.length < 4)
      return false
    // PNG 文件头
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return true
    }
    // JPEG 文件头
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return true
    }
    return false
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
      maxzoom: '14',
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
 * 天地图 · 道路注记图（cia_w）透明叠加层
 * Pakistan + Kashmir 维度，与 msnImageMapPolicyPakistan 区域一致
 * z0-5: 全球, z6-14: 巴基斯坦, z15-17: 克什米尔
 */
export const tiandituCiaPolicyPakistan = {
  name: 'Tianditu Annotation Pakistan (0-14)',
  subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
  levels: [
    ...Array.from({ length: 6 }, (_, i) => ({ z: i })), // z0-5: 全球
    { z: 6, bbox: [20, 5, 115, 65] }, // 中东→东南亚大区域
    { z: 7, bbox: [32, 8, 105, 58] },
    { z: 8, bbox: [42, 12, 97, 52] },
    { z: 9, bbox: [50, 16, 90, 47] },
    { z: 10, bbox: [54, 19, 85, 43] },
    { z: 11, bbox: [57, 21, 82, 40] },
    { z: 12, bbox: [59, 23, 79, 37] }, // 贴近巴基斯坦
    { z: 13, bbox: [61.06957005015404, 23.647551721819234, 77.24701115337578, 37.16707346112021] },
    { z: 14, bbox: [61.06957005015404, 23.647551721819234, 77.24701115337578, 37.16707346112021] },
    { z: 15, bbox: [73.94, 32.34, 79.27, 35.6] }, // z15-17: 克什米尔
    { z: 16, bbox: [73.94, 32.34, 79.27, 35.6] }
    // { z: 17, bbox: [73.94, 32.34, 79.27, 35.6] }
  ],

  downloaderOptions: {
    mode: 'mbtiles',
    mbtilesFile: './output/tianditu_cia_w_pakistan_0_14.mbtiles',
    progressFile: './output/tianditu_cia_w_pakistan_0_14.progress.json',
    concurrency: 3, // ❗ 天地图必须单线程
    delay: 10,
    maxRetry: 3,
    mbBatchSize: 50
  },

  /**
   * DataServer Tile URL
   * 格式：https://t{n}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk={tk}
   */
  getTileUrl(z, x, y, i) {
    if (!tk)
      throw new Error('❌ missing TIANDITU_TK')

    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://${sub}.tianditu.gov.cn/cia_w/wmts`
      + '?SERVICE=WMTS'
      + '&REQUEST=GetTile'
      + '&VERSION=1.0.0'
      + '&LAYER=cia'
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
   * fetch headers
   */
  requestHeaders: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    'Referer': 'https://www.tianditu.gov.cn/',
    'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5'
  },

  /**
   * PNG 校验（cia_w 为透明 PNG）
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
      maxzoom: '16',
      bounds: '-180,-85.0511,180,85.0511',
      center: '69.15829060176492,30.407312591469722,5',
      type: 'overlay',
      attribution: '© 天地图'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}
