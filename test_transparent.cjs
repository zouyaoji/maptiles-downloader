const https = require('node:https')
const { PNG } = require('pngjs')

const base = 'https://dynamic.t0.tiles.ditu.live.com/comp/ch/12312030?mkt=en-us,ur-pk&ur=PK&it=G,BX,L&og=925&n=z&sv=9.43'

const tests = [
  { label: '1. 基准(无st)', url: `${base}&o=PNG` },
  { label: '2. bg|v:0', url: `${base}&o=PNG&st=bg|v:0` },
  { label: '3. bg|fc:00000000', url: `${base}&o=PNG&st=bg|fc:00000000` },
  { label: '4. bg|v:0_wt|v:0', url: `${base}&o=PNG&st=bg|v:0_wt|v:0` },
  { label: '5. 全隐藏bg', url: `${base}&o=PNG&st=me|lv:1_vg|v:0_nh|lv:1_pp|v:1_cp|v:1_trs|v:1;strokeWidthScale:0.2_wt|v:0_cst|v:0_ar|v:0_bg|v:0` }
]

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }))
    }).on('error', reject)
  })
}

async function run() {
  for (const t of tests) {
    const { status, buf } = await download(t.url)
    let info = `status=${status} size=${buf.length}`
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      try {
        const png = PNG.sync.read(buf)
        let a0 = 0
        for (let i = 3; i < png.data.length; i += 4) {
          if (png.data[i] === 0)
            a0++
        }
        const total = png.width * png.height
        const first3 = []
        for (let i = 0; i < 3; i++) first3.push(`rgba(${png.data[i * 4]},${png.data[i * 4 + 1]},${png.data[i * 4 + 2]},${png.data[i * 4 + 3]})`)
        info += ` PNG ${png.width}x${png.height} alpha0=${a0}/${total}(${(a0 / total * 100).toFixed(1)}%) | ${first3.join(' ')}`
      }
      catch (e) { info += ` PNG parse error: ${e.message}` }
    }
    else {
      info += ` format=${buf[0] === 0xFF && buf[1] === 0xD8 ? 'JPEG' : 'other'}`
    }
    console.log(`[${t.label}] ${info}`)
  }
}

run()
