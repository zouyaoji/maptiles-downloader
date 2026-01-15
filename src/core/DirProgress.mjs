import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

export default class DirProgress {
  constructor(root) {
    this.root = root
    this.maps = new Map()
  }

  _file(z) {
    return path.join(this.root, `z${z}.bit`)
  }

  load(z) {
    if (this.maps.has(z))
      return this.maps.get(z)
    const n = 1 << z
    const size = Math.ceil((n * n) / 8)
    const buf = fs.existsSync(this._file(z))
      ? fs.readFileSync(this._file(z))
      : Buffer.alloc(size)
    const bits = new Uint8Array(buf)
    this.maps.set(z, bits)
    return bits
  }

  has(z, x, y) {
    const n = 1 << z
    const idx = y * n + x
    const b = this.load(z)
    return (b[idx >> 3] & (1 << (idx & 7))) !== 0
  }

  set(z, x, y) {
    const n = 1 << z
    const idx = y * n + x
    const b = this.load(z)
    b[idx >> 3] |= 1 << (idx & 7)
  }

  flush() {
    fs.mkdirSync(this.root, { recursive: true })
    for (const [z, b] of this.maps) {
      fs.writeFileSync(this._file(z), Buffer.from(b))
    }
  }
}
