import { Buffer } from 'node:buffer'

/**
 * Amazon AWS Terrarium Elevation Tiles
 * World 维度
 * @see https://registry.opendata.aws/terrain-tiles/
 */
export const amazonawsTerrariumPolicyWorld = {
  name: 'Amazon AWS Terrarium World (0-12)',
  levels: [
    ...Array.from({ length: 13 }, (_, i) => ({ z: i })) // 全球 0-12
  ],
  downloaderOptions: {
    mode: 'mbtiles',
    outDir: './output',
    mbtilesFile: './output/amazonaws_ter_world_0_12.mbtiles',
    progressFile: './output/amazonaws_ter_world_0_12.progress.json',
    concurrency: 800,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y) {
    return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
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
      attribution: '© AWS Open Data / Mapzen Terrarium'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}

/**
 * Amazon AWS Terrarium Elevation Tiles
 * China 维度
 * @see https://registry.opendata.aws/terrain-tiles/
 */
export const amazonawsTerrariumPolicyChina = {
  name: 'Amazon AWS Terrarium China (13-15)',
  levels: [
    ...Array.from({ length: 3 }, (_, i) => ({
      z: 13 + i,
      bbox: [73, 3, 135, 54]
    }))
  ],
  downloaderOptions: {
    mode: 'mbtiles',
    outDir: './output',
    mbtilesFile: './output/amazonaws_ter_china_13_15.mbtiles',
    progressFile: './output/amazonaws_ter_china_13_15.progress.json',
    concurrency: 256,
    maxRetry: 5,
    mbBatchSize: 250,
    delay: 50
  },
  getTileUrl(z, x, y) {
    return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
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
      maxzoom: '15',
      bounds: '73,3,135,54',
      center: '104,30,13',
      type: 'baselayer',
      attribution: '© AWS Open Data / Mapzen Terrarium'
    }

    const stmt = db.prepare('INSERT INTO metadata VALUES (?,?)')
    Object.entries(meta).forEach(([k, v]) => stmt.run(k, v))
  }
}
