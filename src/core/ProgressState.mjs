import fs from 'node:fs'

export default class ProgressState {
  constructor(file) {
    this.file = file
    this.cursor = null
    this.failed = []
  }

  load() {
    if (!fs.existsSync(this.file))
      return
    try {
      const j = JSON.parse(fs.readFileSync(this.file, 'utf-8'))
      this.cursor = j.cursor || null
      this.failed = j.failed || []
      console.log('♻️ 已恢复进度:', this.cursor)
    }
    catch {
      console.warn('⚠️ progress.json 解析失败，忽略')
    }
  }

  save(cursor, failed) {
    fs.writeFileSync(this.file, JSON.stringify({ cursor, failed }, null, 2))
  }
}
