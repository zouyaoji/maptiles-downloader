import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import Database from 'better-sqlite3'
import { bboxToTileRange, computeTileRange, tmsY } from '../utils/tile.mjs'
import DirProgress from './DirProgress.mjs'
import ProgressState from './ProgressState.mjs'
import RuntimeStats from './RuntimeStats.mjs'

export default class Downloader {
  constructor(policy) {
    this.mode = policy.downloaderOptions.mode ?? 'mbtiles'
    this.outDir = policy.downloaderOptions.outDir ?? './tiles'
    this.mbtilesFile
      = policy.downloaderOptions.mbtilesFile ?? './tiles/tiles.mbtiles'
    this.progressFile
      = policy.downloaderOptions.progressFile ?? './tiles/progress.json'
    this.concurrency = policy.downloaderOptions.concurrency ?? 128
    this.maxRetry = policy.downloaderOptions.maxRetry ?? 5
    this.mbBatchSize = policy.downloaderOptions.mbBatchSize ?? 200
    this.delay = policy.downloaderOptions.delay ?? 50
    this.dynamicDelay = this.delay
    this.minDelay = policy.downloaderOptions.minDelay ?? 10
    this.maxDelay = policy.downloaderOptions.maxDelay ?? 2000
    this.window = policy.downloaderOptions.window ?? 100

    this.policy = policy
    this.mbBuffer = []
    this.failedTiles = []
    this.retryQueue = []

    this.totalTiles = 0
    this.done = 0
    this.startTime = Date.now()
    this.stopped = false
    this.cursor = null

    this.progress = new ProgressState(this.progressFile)
    this.progress.load()
    this.stats = new RuntimeStats(500)
    this.recentResults = []

    if (this.mode === 'dir') {
      this.dirProgress = new DirProgress(path.join(this.outDir, '.progress'))
    }

    this._onSigint = this._onSigint.bind(this)
  }

  initMBTiles() {
    fs.mkdirSync(path.dirname(this.mbtilesFile), { recursive: true })
    this.db = new Database(this.mbtilesFile)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = OFF')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB,
        PRIMARY KEY (zoom_level,tile_column,tile_row)
      );
    `)
    this.insertMany = this.db.transaction((rows) => {
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO tiles VALUES (?,?,?,?)'
      )
      for (const r of rows) stmt.run(r.z, r.x, r.y, r.buf)
    })
    this.existsStmt = this.db.prepare(
      `SELECT 1 FROM tiles
     WHERE zoom_level=? AND tile_column=? AND tile_row=?`
    )
  }

  bufferInsert(z, x, y, buf) {
    this.mbBuffer.push({ z, x, y: tmsY(y, z), buf })
    if (this.mbBuffer.length >= this.mbBatchSize) {
      this.insertMany(this.mbBuffer)
      this.mbBuffer.length = 0
    }
  }

  flushMBTiles() {
    if (this.mbBuffer.length) {
      this.insertMany(this.mbBuffer)
      this.mbBuffer.length = 0
    }
  }

  /* ---------- adaptive delay ---------- */
  recordResult(success) {
    this.recentResults.push(!!success)
    if (this.recentResults.length > this.window)
      this.recentResults.shift()
  }

  recentFailRate() {
    if (this.recentResults.length === 0)
      return 0
    const fails = this.recentResults.filter(v => !v).length
    return fails / this.recentResults.length
  }

  adjustDelay() {
    const rate = this.recentFailRate()
    // console.log(rate)
    if (rate > 0.3) {
      this.dynamicDelay = Math.min(this.dynamicDelay * 1.5, this.maxDelay)
    }
    else if (rate > 0.1) {
      this.dynamicDelay = Math.min(this.dynamicDelay * 1.2, this.maxDelay)
    }
    else if (rate < 0.01) {
      this.dynamicDelay = Math.max(this.dynamicDelay * 0.7, this.minDelay)
    }
    else if (rate < 0.05) {
      this.dynamicDelay = Math.max(this.dynamicDelay * 0.9, this.minDelay)
    }
    else {
      this.dynamicDelay = this.delay
    }
  }

  /* ---------- progress display ---------- */
  formatEta(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0)
      return '--'

    let remaining = Math.round(seconds)
    const day = Math.floor(remaining / 86400)
    remaining %= 86400
    const hour = Math.floor(remaining / 3600)
    remaining %= 3600
    const minute = Math.floor(remaining / 60)
    const second = remaining % 60
    const showSeconds = seconds <= 5 * 60

    if (day > 0)
      return showSeconds ? `${day}天${hour}时${minute}分${second}秒` : `${day}天${hour}时${minute}分`
    if (hour > 0)
      return showSeconds ? `${hour}时${minute}分${second}秒` : `${hour}时${minute}分`
    if (minute > 0)
      return showSeconds ? `${minute}分${second}秒` : `${minute}分`
    return `${second}秒`
  }

  showProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000
    const avg = elapsed ? this.done / elapsed : 0
    const inst = this.stats.speed(this.done).toFixed(1)
    const remain = this.totalTiles - this.done
    const eta = avg > 0 ? remain / avg : 0

    process.stdout.write(
      `\r📦 ${this.done}/${this.totalTiles}`
      + ` | ⚡ ${inst} t/s (avg ${avg.toFixed(1)})`
      + ` | 🔜 ${this.formatEta(eta)}`
      + ` | ❌ ${this.stats.failRate.toFixed(2)}%`
      + ` | ♻️ skip ${this.stats.skipRate.toFixed(1)}%`
      + ` | 🔁 retry ${this.retryQueue.length}`
      + ` | ⏱ ${this.dynamicDelay ?? this.delay}ms`
      + ` | ${this.cursor?.z}/${this.cursor?.x}/${this.cursor?.y}`
    )
  }

  async downloadTile(z, x, y) {
    const u = this.policy.getTileUrl(z, x, y, Date.now())
    // console.log('asdas', u)
    try {
      const r = await fetch(u, {
        headers: this.policy.requestHeaders
      })
      if (!r.ok) {
        console.log(`❌ ${z}/${x}/${y} HTTP ${r.status}`)
        return null
      }
      const b = Buffer.from(await r.arrayBuffer())

      if (!this.policy.validateTile(b)) {
        console.log(`❌ ${z}/${x}/${y} invalid tile`)
        return null
      }

      return b
    }
    catch (err) {
      console.log(`❌ ${z}/${x}/${y} error: ${err.message}`)
      return null
    }
  }

  * tileGenerator(levels, cursor) {
    let skip = !!cursor
    for (const { z, bbox } of levels) {
      const r = bbox
        ? bboxToTileRange(bbox, z)
        : { minX: 0, maxX: (1 << z) - 1, minY: 0, maxY: (1 << z) - 1 }
      this.totalTiles += (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1)
      for (let x = r.minX; x <= r.maxX; x++) {
        for (let y = r.minY; y <= r.maxY; y++) {
          if (skip) {
            if (cursor && cursor.z === z && cursor.x === x && cursor.y === y)
              skip = false
            continue
          }
          yield { z, x, y }
        }
      }
    }
  }

  async worker(gen) {
    while (!this.stopped) {
      const job = this.retryQueue.shift() ?? gen.next().value
      if (!job)
        return
      const { z, x, y } = job

      this.cursor = { z, x, y }

      if (this.mode === 'dir' && this.dirProgress.has(z, x, y)) {
        this.stats.mark('skip')
        this.done++
        if (this.done % 20 === 0)
          this.showProgress()
        continue
      }
      else if (this.mode === 'mbtile') {
        if (this.existsStmt.get(z, x, tmsY(y, z))) {
          this.stats.mark('skip')
          this.done++
          if (this.done % 20 === 0)
            this.showProgress()
          continue
        }
      }

      const buf = await this.downloadTile(z, x, y)

      this.recordResult(!!buf)
      this.adjustDelay()

      if (buf) {
        if (this.mode === 'mbtiles') {
          this.bufferInsert(z, x, y, buf)
        }
        else {
          const f = `${this.outDir}/${z}/${x}/${y}.png`
          fs.mkdirSync(path.dirname(f), { recursive: true })
          fs.writeFileSync(f, buf)
          this.dirProgress.set(z, x, y)
        }
        this.stats.mark('ok')
        this.done++
      }
      else {
        this.stats.mark('fail')
        job.retry = (job.retry || 0) + 1
        if (job.retry <= this.maxRetry)
          this.retryQueue.push(job)
        else this.failedTiles.push({ z, x, y })
      }

      if (this.done % (~~(this.concurrency / 10) || 1) === 0)
        this.showProgress()
      if (this.done % (~~(this.done / 2) || 1) === 0)
        this.progress.save(this.cursor, this.failedTiles)

      await sleep(this.dynamicDelay ?? this.delay)
    }
  }

  async retryFailed() {
    if (!this.failedTiles.length)
      return
    console.log(`\n🔁 retry failed: ${this.failedTiles.length}`)
    for (const t of this.failedTiles) {
      const buf = await this.downloadTile(t.z, t.x, t.y)
      if (buf) {
        if (this.mode === 'mbtiles') {
          this.bufferInsert(t.z, t.x, t.y, buf)
        }
        else {
          const f = `${this.outDir}/${t.z}/${t.x}/${t.y}.png`
          fs.mkdirSync(path.dirname(f), { recursive: true })
          fs.writeFileSync(f, buf)
          this.dirProgress.set(t.z, t.x, t.y)
        }
      }
    }
  }

  async run(levels) {
    if (this.mode === 'mbtiles')
      this.initMBTiles()
    process.on('SIGINT', this._onSigint)

    const gen = this.tileGenerator(levels, this.progress.cursor)
    await Promise.all(
      Array.from({ length: this.concurrency }, () => this.worker(gen))
    )

    await this.retryFailed()

    if (this.mode === 'mbtiles') {
      this.flushMBTiles()
      this.policy.generateMetadata?.(this.db)
      if (this.checkIntegrityByLevels(levels)) {
        this.repairMissingTiles(levels)
      }
      else {
        this.db.close()
      }
    }
    else {
      this.dirProgress.flush()
    }

    this.progress.save(null, [])
    console.log('\n✅ 全部完成')
  }

  /* ===================== MBTiles Integrity Check ===================== */
  checkIntegrityByLevels(levels) {
    if (this.mode !== 'mbtiles') {
      console.warn('⚠️ integrity check only supports mbtiles')
      return
    }

    console.log('\n🔍 Checking MBTiles integrity...\n')

    let totalExpected = 0
    let totalActual = 0
    let hasMissing = false

    for (const level of levels) {
      const { z } = level
      const r = computeTileRange(level)

      const expected = (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1)

      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS cnt
         FROM tiles
         WHERE zoom_level = ?
           AND tile_column BETWEEN ? AND ?
           AND tile_row BETWEEN ? AND ?`
        )
        .get(z, r.minX, r.maxX, tmsY(r.maxY, z), tmsY(r.minY, z))

      // @ts-ignore
      const actual = row?.cnt ?? 0

      totalExpected += expected
      totalActual += actual

      const ok = actual >= expected
      if (!ok)
        hasMissing = true

      console.log(
        `z${z}: ${actual}/${expected} ${
          ok ? '✅' : `❌ MISSING ${expected - actual}`
        }`
      )
    }

    console.log('\n📊 Summary:')
    console.log(`Expected: ${totalExpected}`)
    console.log(`Actual  : ${totalActual}`)
    console.log(
      hasMissing ? '❌ MBTiles is INCOMPLETE' : '✅ MBTiles looks COMPLETE'
    )

    return hasMissing
  }

  findFirstMissingTile(levels) {
    if (this.mode !== 'mbtiles')
      return null

    console.log('🔎 scanning first missing tile...')

    for (const level of levels) {
      const { z } = level
      const r = computeTileRange(level)

      for (let x = r.minX; x <= r.maxX; x++) {
        for (let y = r.minY; y <= r.maxY; y++) {
          const ty = tmsY(y, z)
          const row = this.existsStmt.get(z, x, ty)
          if (!row) {
            console.log(`❗ first missing tile: ${z}/${x}/${y}`)
            return { z, x, y }
          }
        }
      }
    }

    return null
  }

  prevTile(target, levels) {
    let prev = null

    for (const level of levels) {
      const { z } = level
      const r = computeTileRange(level)

      for (let x = r.minX; x <= r.maxX; x++) {
        for (let y = r.minY; y <= r.maxY; y++) {
          if (z === target.z && x === target.x && y === target.y) {
            return prev // ⭐ 找到目标，返回前一个
          }
          prev = { z, x, y }
        }
      }
    }

    return null
  }

  collectMissingTiles(levels) {
    if (this.mode !== 'mbtiles') {
      throw new Error('repair only supports mbtiles mode')
    }

    console.log('\n🔍 Scanning missing tiles (by levels)...')

    const missing = []

    for (const level of levels) {
      const { z } = level
      const r = computeTileRange(level)

      for (let x = r.minX; x <= r.maxX; x++) {
        for (let y = r.minY; y <= r.maxY; y++) {
          const ty = tmsY(y, z)
          const row = this.existsStmt.get(z, x, ty)
          if (!row) {
            missing.push({ z, x, y })
          }
        }
      }

      console.log(
        `z${z} scanned → missing ${missing.filter(t => t.z === z).length}`
      )
    }

    console.log(`\n❗ Total missing tiles: ${missing.length}`)
    return missing
  }

  async repairMissingTiles(levels, listen = false) {
    if (this.mode !== 'mbtiles') {
      throw new Error('repair only supports mbtiles mode')
    }

    const works = 10
    // this.initMBTiles()

    if (listen) {
      process.on('SIGINT', () => {
        console.log('\n⛔ 捕捉 CTRL+C，安全退出...')
        this.flushMBTiles()
        this.db?.close()
        process.exit(0)
      })
    }

    const missing = this.collectMissingTiles(levels)
    if (!missing.length) {
      console.log('✅ No missing tiles')
      return
    }

    console.log(`🔧 Repairing ${missing.length} tiles with ${works} workers`)

    let index = 0
    let done = 0
    let active = 0

    const next = async () => {
      if (index >= missing.length)
        return
      const { z, x, y } = missing[index++]
      active++

      this.downloadTile(z, x, y)
        .then((buf) => {
          if (buf)
            this.bufferInsert(z, x, y, buf)
        })
        .catch(() => {})
        .finally(() => {
          done++
          active--
          if (done % 50 === 0) {
            process.stdout.write(`\r🔧 repaired ${done}/${missing.length}`)
          }
          next()
        })
    }

    // 启动并发
    for (let i = 0; i < works; i++) next()

    // 等待完成
    // eslint-disable-next-line no-unmodified-loop-condition
    while (done < missing.length || active > 0) {
      await sleep(200)
    }

    this.flushMBTiles()
    this.policy.generateMetadata?.(this.db)
    this.db.close()

    console.log(`\n✅ Repair finished: ${done}/${missing.length}`)
  }

  _onSigint() {
    console.log('\n⛔ 捕捉 CTRL+C，安全退出...')
    this.stopped = true
    this.progress.save(this.cursor, this.failedTiles)
    if (this.mode === 'mbtiles') {
      this.flushMBTiles()
      this.db?.close()
    }
    else {
      this.dirProgress.flush()
    }
    process.exit()
  }
}
