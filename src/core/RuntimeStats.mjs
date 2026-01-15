export default class RuntimeStats {
  constructor(windowSize = 500) {
    this.startTime = Date.now()

    this.reqTotal = 0
    this.reqOk = 0
    this.reqFail = 0
    this.reqSkip = 0

    this.window = []
    this.windowSize = windowSize
  }

  mark(type) {
    this.reqTotal++
    if (type === 'ok')
      this.reqOk++
    else if (type === 'fail')
      this.reqFail++
    else if (type === 'skip')
      this.reqSkip++

    this.window.push(type)
    if (this.window.length > this.windowSize) {
      const old = this.window.shift()
      if (old === 'ok')
        this.reqOk--
      else if (old === 'fail')
        this.reqFail--
      else if (old === 'skip')
        this.reqSkip--
    }
  }

  get failRate() {
    const n = this.reqOk + this.reqFail
    return n ? (this.reqFail / n) * 100 : 0
  }

  get skipRate() {
    const n = this.reqOk + this.reqSkip
    return n ? (this.reqSkip / n) * 100 : 0
  }

  speed(done) {
    const elapsed = (Date.now() - this.startTime) / 1000
    return elapsed ? done / elapsed : 0
  }
}
