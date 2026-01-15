import { Buffer } from 'node:buffer'
import { tileXYToQuadKey } from '../utils/tile.mjs'

/**
 * 微软msn街道图 world 维度。
 * @see https://www.msn.com/zh-cn/weather/maps/precipitation?zoom=6&rcmode=1
 */
export const msnStreetMapPolicyWorld = {
  name: 'MSN Street Map World (0-12)',
  subdomains: ['t0', 't1', 't2', 't3'],
  levels: [
    ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
    // ...Array.from({ length: 4 }, (_, i) => ({
    //   z: 13 + i,
    //   bbox: [73, 3, 135, 54]
    // })) // 国家级重点 13-16
    // { z: 17, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
    // { z: 18, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
  ],
  downloaderOptions: {
    // mode: 'dir',
    outDir: './output',
    mbtilesFile: './output/msn_street_world_0_12.mbtiles',
    progressFile: './output/msn_street_world_0_12.progress.json',
    concurrency: 512,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y, i) {
    const quadKey = tileXYToQuadKey(x, y, z)
    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://dynamic.${sub}.tiles.ditu.live.com/comp/ch/${quadKey}`
      + `?mkt=zh-cn,en-us&ur=CN&it=G,BX,L&cstl=wr&og=925&n=z&rs=1&dpi=d1&o=webp&st=me|lv:1_vg|v:0_nh|lv:1_pp|v:1_cp|v:1_trs|v:1;strokeWidthScale:0.2_wt|fc:B3E5FC_cst|v:0_ar|v:0&jp=0&sv=9.43`
    )
  },
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },
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
      attribution: '© Bing Maps'
    }
    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 微软msn街道图 china 维度。
 * @see https://www.msn.com/zh-cn/weather/maps/precipitation?zoom=6&rcmode=1
 */
export const msnStreetMapPolicyChina = {
  name: 'MSN Street Map China (13-16)',
  subdomains: ['t0', 't1', 't2', 't3'],
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })), // 全球 0-12
    ...Array.from({ length: 4 }, (_, i) => ({
      z: 13 + i,
      bbox: [73, 3, 135, 54]
    })) // 国家级重点 13-16
    // { z: 17, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
    // { z: 18, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
  ],
  downloaderOptions: {
    mode: 'mbtiles',
    // mode: 'dir',
    outDir: './output',
    mbtilesFile: './output/msn_street_china_13_16.mbtiles',
    progressFile: './output/msn_street_china_13_16.progress.json',
    concurrency: 512,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y, i) {
    const quadKey = tileXYToQuadKey(x, y, z)
    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://dynamic.${sub}.tiles.ditu.live.com/comp/ch/${quadKey}`
      + `?mkt=zh-cn,en-us&ur=CN&it=G,BX,L&cstl=wr&og=925&n=z&rs=1&dpi=d1&o=webp&st=me|lv:1_vg|v:0_nh|lv:1_pp|v:1_cp|v:1_trs|v:1;strokeWidthScale:0.2_wt|fc:B3E5FC_cst|v:0_ar|v:0&jp=0&sv=9.43`
    )
  },
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },
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
      attribution: '© Bing Maps'
    }
    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 微软msn街道图 province 维度。
 * @see https://www.msn.com/zh-cn/weather/maps/precipitation?zoom=6&rcmode=1
 */
export const msnStreetMapPolicyProvince = {
  name: 'MSN Street Map Guangxi (17-18)',
  subdomains: ['t0', 't1', 't2', 't3'],
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })), // 全球 0-12
    // ...Array.from({ length: 4 }, (_, i) => ({
    //   z: 13 + i,
    //   bbox: [73, 3, 135, 54]
    // })) // 国家级重点 13-16
    { z: 17, bbox: [104, 20, 112.5, 26.5] }, // 省级重点（广西） 17-18
    { z: 18, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 17-18
  ],
  downloaderOptions: {
    mode: 'mbtiles',
    outDir: './output',
    mbtilesFile: './output/msn_street_guangxi_17_18.mbtiles',
    progressFile: './output/msn_street_guangxi_17_18.progress.json',
    concurrency: 512,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y, i) {
    const quadKey = tileXYToQuadKey(x, y, z)
    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://dynamic.${sub}.tiles.ditu.live.com/comp/ch/${quadKey}`
      + `?mkt=zh-cn,en-us&ur=CN&it=G,BX,L&cstl=wr&og=925&n=z&rs=1&dpi=d1&o=webp&st=me|lv:1_vg|v:0_nh|lv:1_pp|v:1_cp|v:1_trs|v:1;strokeWidthScale:0.2_wt|fc:B3E5FC_cst|v:0_ar|v:0&jp=0&sv=9.43`
    )
  },
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },
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
      attribution: '© Bing Maps'
    }
    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 微软msn山影图 world 维度。
 * @see https://www.msn.com/zh-cn/weather/maps/temperature?zoom=7&rcmode=1
 */
export const msnShadowMapPolicyWorld = {
  name: 'MSN Shadow Map World (0-12)',
  subdomains: ['t0', 't1', 't2', 't3'],
  levels: [
    ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
    // { z: 13, bbox: [73, 3, 135, 54] },
    // { z: 14, bbox: [73, 3, 135, 54] }, // 国家级重点 13-14
    // { z: 15, bbox: [104, 20, 112.5, 26.5] },
    // { z: 16, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 15-16
  ],
  downloaderOptions: {
    mode: 'mbtiles',
    outDir: './output',
    mbtilesFile: './output/msn_shadow_world_0_12.mbtiles',
    progressFile: './output/msn_shadow_world_0_12.progress.json',
    concurrency: 512,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y, i) {
    const quadKey = tileXYToQuadKey(x, y, z)
    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://dynamic.${sub}.tiles.ditu.live.com/comp/ch/${quadKey}`
      + `?mkt=zh-cn,en-us&ur=CN&it=Z,GF,L&cstl=wr&og=925&n=z&rs=1&dpi=d1&o=PNG&st=me|lv:0_nh|lv:0_pp|v:0_cp|v:0_trs|v:0;lv:0;sc:FF6B6B6B;lbc:FA233333;loc:40FFFFFF;fc:FF6B6B6B;strokeWidthScale:0.2_cst|v:0;fc:FFFF0000;strokeWidthScale:1_cr|bv:0;bsc:ff0000;borderWidthScale:0_ar|v:1_rd|labelScale:1.4;lbc:FF000000;loc:08FFFFFF&shdw=1&shading=t&jp=0&sv=9.43`
    )
  },
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },
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
      type: 'overlayer',
      attribution: '© Bing Maps'
    }
    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 微软msn山影图 china 维度。
 * @see https://www.msn.com/zh-cn/weather/maps/temperature?zoom=7&rcmode=1
 */
export const msnShadowMapPolicyChina = {
  name: 'MSN Shadow Map China (13-14)',
  subdomains: ['t0', 't1', 't2', 't3'],
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
    { z: 13, bbox: [73, 3, 135, 54] },
    { z: 14, bbox: [73, 3, 135, 54] } // 国家级重点 13-14
    // { z: 15, bbox: [104, 20, 112.5, 26.5] },
    // { z: 16, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 15-16
  ],
  downloaderOptions: {
    mode: 'mbtiles',
    outDir: './output',
    mbtilesFile: './output/msn_shadow_china_13_14.mbtiles',
    progressFile: './output/msn_shadow_china_13_14.progress.json',
    concurrency: 512,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y, i) {
    const quadKey = tileXYToQuadKey(x, y, z)
    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://dynamic.${sub}.tiles.ditu.live.com/comp/ch/${quadKey}`
      + `?mkt=zh-cn,en-us&ur=CN&it=Z,GF,L&cstl=wr&og=925&n=z&rs=1&dpi=d1&o=PNG&st=me|lv:0_nh|lv:0_pp|v:0_cp|v:0_trs|v:0;lv:0;sc:FF6B6B6B;lbc:FA233333;loc:40FFFFFF;fc:FF6B6B6B;strokeWidthScale:0.2_cst|v:0;fc:FFFF0000;strokeWidthScale:1_cr|bv:0;bsc:ff0000;borderWidthScale:0_ar|v:1_rd|labelScale:1.4;lbc:FF000000;loc:08FFFFFF&shdw=1&shading=t&jp=0&sv=9.43`
    )
  },
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },
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
      type: 'overlayer',
      attribution: '© Bing Maps'
    }
    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * 微软msn山影图 province 维度。
 * @see https://www.msn.com/zh-cn/weather/maps/temperature?zoom=7&rcmode=1
 */
export const msnShadowMapPolicyProvince = {
  name: 'MSN Shadow Map Guangxi (15-16)',
  subdomains: ['t0', 't1', 't2', 't3'],
  levels: [
    // ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
    // { z: 13, bbox: [73, 3, 135, 54] },
    // { z: 14, bbox: [73, 3, 135, 54] } // 国家级重点 13-14
    { z: 15, bbox: [104, 20, 112.5, 26.5] },
    { z: 16, bbox: [104, 20, 112.5, 26.5] } // 省级重点（广西） 15-16
  ],
  downloaderOptions: {
    mode: 'mbtiles',
    outDir: './output',
    mbtilesFile: './output/msn_shadow_guangxi_15_16.mbtiles',
    progressFile: './output/msn_shadow_guangxi_15_16.progress.json',
    concurrency: 512,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y, i) {
    const quadKey = tileXYToQuadKey(x, y, z)
    const sub = this.subdomains[i % this.subdomains.length]
    return (
      `https://dynamic.${sub}.tiles.ditu.live.com/comp/ch/${quadKey}`
      + `?mkt=zh-cn,en-us&ur=CN&it=Z,GF,L&cstl=wr&og=925&n=z&rs=1&dpi=d1&o=PNG&st=me|lv:0_nh|lv:0_pp|v:0_cp|v:0_trs|v:0;lv:0;sc:FF6B6B6B;lbc:FA233333;loc:40FFFFFF;fc:FF6B6B6B;strokeWidthScale:0.2_cst|v:0;fc:FFFF0000;strokeWidthScale:1_cr|bv:0;bsc:ff0000;borderWidthScale:0_ar|v:1_rd|labelScale:1.4;lbc:FF000000;loc:08FFFFFF&shdw=1&shading=t&jp=0&sv=9.43`
    )
  },
  validateTile(buf) {
    return (
      buf
      && buf.length > 8
      && buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    )
  },
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
      type: 'overlayer',
      attribution: '© Bing Maps'
    }
    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}
