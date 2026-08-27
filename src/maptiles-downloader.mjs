import path from 'node:path'
import process from 'node:process'
import Downloader from './core/Downloader.mjs'
import { amazonawsTerrariumPolicyChina, amazonawsTerrariumPolicyWorld } from './policy/amazonaws.mjs'
import { msnImageMapPolicyChina, msnImageMapPolicyPakistan, msnImageMapPolicyProvince, msnImageMapPolicyShaoguan, msnImageMapPolicyWorld, msnImageMapPolicyYilong, msnShadowMapPolicyChina, msnShadowMapPolicyProvince, msnShadowMapPolicyWorld, msnStreetMapPolicyChina, msnStreetMapPolicyProvince, msnStreetMapPolicyWorld } from './policy/msn.mjs'
import { tiandituCiaPolicyPakistan, tiandituImgPolicyChina, tiandituImgPolicyProvince, tiandituImgPolicyShaoguan, tiandituImgPolicyWorld, tiandituTerPolicyChina, tiandituTerPolicyWorld, tiandituVecPolicyChina, tiandituVecPolicyProvince, tiandituVecPolicyWorld } from './policy/tianditu.mjs'

const checkOnly = process.argv.includes('--check-only')
const repairOnly = process.argv.includes('--repair-only')
const acceptNoTile = process.argv.includes('--accept-no-tile')

/**
 * 解析命令行参数 --key=value / --key value / 布尔开关 --key
 * @returns {Record<string, string | boolean>} 解析后的参数映射表
 */
function parseArgs() {
  const args = process.argv.slice(2)
  /** @type {Record<string, string | boolean>} */
  const params = {}

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--'))
      continue
    const eq = args[i].indexOf('=')
    const key = args[i].substring(2, eq >= 0 ? eq : undefined)
    if (eq >= 0) {
      // --key=value
      params[key] = args[i].substring(eq + 1)
    }
    else if (args[i + 1] && !args[i + 1].startsWith('--')) {
      // --key value
      params[key] = args[++i]
    }
    else {
      // 布尔开关
      params[key] = true
    }
  }

  return params
}

/** @type {*[]} */
const policys = []

const args = /** @type {Record<string, string | boolean>} */ (parseArgs())
console.log('Type:', args.type) // --type=msn_street → "msn_street"

switch (args.type) {
  case 'msn_street_world': {
    policys.push(...[
      msnStreetMapPolicyWorld
    ])
    break
  }
  case 'msn_street_china': {
    policys.push(...[
      msnStreetMapPolicyChina
    ])
    break
  }
  case 'msn_street_province': {
    policys.push(...[
      msnStreetMapPolicyProvince
    ])
    break
  }
  case 'msn_shadow_world': {
    policys.push(...[
      msnShadowMapPolicyWorld
    ])
    break
  }
  case 'msn_image_world': {
    policys.push(...[
      msnImageMapPolicyWorld
    ])
    break
  }
  case 'msn_shadow_china': {
    policys.push(...[
      msnShadowMapPolicyChina
    ])
    break
  }
  case 'msn_image_china': {
    policys.push(...[
      msnImageMapPolicyChina
    ])
    break
  }
  case 'msn_image_pakistan': {
    policys.push(...[
      msnImageMapPolicyPakistan
    ])
    break
  }
  case 'msn_image_shaoguan': {
    policys.push(...[
      msnImageMapPolicyShaoguan
    ])
    break
  }
  case 'msn_shadow_province': {
    policys.push(...[
      msnShadowMapPolicyProvince
    ])
    break
  }
  case 'msn_image_province': {
    policys.push(...[
      msnImageMapPolicyProvince
    ])
    break
  }
  case 'msn_image_yilong': {
    policys.push(...[
      msnImageMapPolicyYilong
    ])
    break
  }
  case 'tianditu_vec_w_world': {
    policys.push(...[
      tiandituVecPolicyWorld
    ])
    break
  }
  case 'tianditu_vec_w_china': {
    policys.push(...[
      tiandituVecPolicyChina
    ])
    break
  }
  case 'tianditu_vec_w_province': {
    policys.push(...[
      tiandituVecPolicyProvince
    ])
    break
  }
  case 'tianditu_img_w_world': {
    policys.push(...[
      tiandituImgPolicyWorld
    ])
    break
  }
  case 'tianditu_img_w_china': {
    policys.push(...[
      tiandituImgPolicyChina
    ])
    break
  }
  case 'tianditu_img_w_shaoguan': {
    policys.push(...[
      tiandituImgPolicyShaoguan
    ])
    break
  }
  case 'tianditu_img_w_province': {
    policys.push(...[
      tiandituImgPolicyProvince
    ])
    break
  }
  case 'tianditu_ter_w_world': {
    policys.push(...[
      tiandituTerPolicyWorld
    ])
    break
  }
  case 'tianditu_ter_w_china': {
    policys.push(...[
      tiandituTerPolicyChina
    ])
    break
  }
  // case 'tianditu_ter_w_province': {
  //   policys.push(...[
  //     tiandituTerPolicyProvince
  //   ])
  //   break
  // }
  case 'tianditu_cia_w_pakistan': {
    policys.push(...[
      tiandituCiaPolicyPakistan
    ])
    break
  }
  case 'amazonaws_ter_world': {
    policys.push(...[
      amazonawsTerrariumPolicyWorld
    ])
    break
  }
  case 'amazonaws_ter_china': {
    policys.push(...[
      amazonawsTerrariumPolicyChina
    ])
    break
  }
}

/* ===================== 区域 / 层级覆盖参数 ===================== */
// --bbox minLon,minLat,maxLon,maxLat ：将选定的 type 限定到指定范围
// --min-z / --max-z ：限定层级（配合 --bbox 时直接合成该层级区间）
// --out ：指定输出 mbtiles（默认自动重命名，避免覆盖预设输出）
const overrideBBox = typeof args.bbox === 'string' ? args.bbox.split(',').map(Number) : null
const overrideMinZ = typeof args['min-z'] === 'string' ? Number.parseInt(args['min-z'], 10) : null
const overrideMaxZ = typeof args['max-z'] === 'string' ? Number.parseInt(args['max-z'], 10) : null
const overrideOut = typeof args.out === 'string' ? args.out : null

if (overrideBBox && (overrideBBox.length !== 4 || overrideBBox.some(n => !Number.isFinite(n)))) {
  console.error('❌ --bbox 格式错误，应为: minLon,minLat,maxLon,maxLat')
  process.exit(1)
}
if ((overrideMinZ != null && !Number.isInteger(overrideMinZ)) || (overrideMaxZ != null && !Number.isInteger(overrideMaxZ))) {
  console.error('❌ --min-z / --max-z 需为整数')
  process.exit(1)
}
if (overrideMinZ != null && overrideMaxZ != null && overrideMinZ > overrideMaxZ) {
  console.error('❌ --min-z 不能大于 --max-z')
  process.exit(1)
}

/**
 * 应用区域/层级覆盖到策略（--bbox / --min-z / --max-z / --out）
 * @param {typeof import('./policy/amazonaws.mjs').amazonawsTerrariumPolicyWorld} policy
 */
function applyRegionOverrides(policy) {
  const active = overrideBBox || overrideMinZ != null || overrideMaxZ != null || overrideOut
  if (!active)
    return

  const origLevels = policy.levels
  /** @type {Array<{ z: number, bbox?: number[] }>} */
  let levels
  if (overrideBBox) {
    const minZ = overrideMinZ ?? Math.min(...origLevels.map(l => l.z))
    const maxZ = overrideMaxZ ?? Math.max(...origLevels.map(l => l.z))
    levels = Array.from({ length: maxZ - minZ + 1 }, (_, i) => ({ z: minZ + i, bbox: overrideBBox }))
  }
  else {
    levels = origLevels.filter(l =>
      (overrideMinZ == null || l.z >= overrideMinZ)
      && (overrideMaxZ == null || l.z <= overrideMaxZ)
    )
  }
  if (levels.length === 0) {
    console.error('❌ 覆盖参数后没有有效层级')
    process.exit(1)
  }
  policy.levels = levels

  const zoomList = levels.map(l => l.z)
  const minzoom = Math.min(...zoomList)
  const maxzoom = Math.max(...zoomList)
  const bboxTag = overrideBBox ? `_${overrideBBox.join('_')}` : ''
  const tag = `_r${minzoom}-${maxzoom}${bboxTag}`

  // 输出文件（--out 优先，否则自动重命名避免覆盖预设）
  if (overrideOut) {
    const p = path.parse(overrideOut)
    policy.downloaderOptions.mbtilesFile = overrideOut
    policy.downloaderOptions.progressFile = path.join(p.dir, `${p.name}.progress.json`)
  }
  else {
    const mb = policy.downloaderOptions.mbtilesFile
    const mbExt = path.extname(mb)
    policy.downloaderOptions.mbtilesFile = path.join(path.dirname(mb), `${path.basename(mb, mbExt)}${tag}${mbExt}`)
    const pf = policy.downloaderOptions.progressFile
    const pfExt = path.extname(pf ?? '')
    const pfBase = pf ? path.basename(pf, pfExt) : path.basename(policy.downloaderOptions.mbtilesFile, mbExt)
    policy.downloaderOptions.progressFile = path.join(path.dirname(pf ?? './output'), `${pfBase}${tag}${pfExt}`)
  }

  // metadata 动态化（先写原始字段，再覆盖区域信息）
  const bboxes = levels.map(l => l.bbox).filter(Boolean)
  const bounds = overrideBBox ?? (bboxes.length
    ? [
        Math.min(...bboxes.map(b => b[0])),
        Math.min(...bboxes.map(b => b[1])),
        Math.max(...bboxes.map(b => b[2])),
        Math.max(...bboxes.map(b => b[3]))
      ]
    : [-180, -85.0511, 180, 85.0511])
  const center = [
    ((bounds[0] + bounds[2]) / 2).toFixed(6),
    ((bounds[1] + bounds[3]) / 2).toFixed(6),
    Math.floor((minzoom + maxzoom) / 2)
  ].join(',')

  const origGenerate = policy.generateMetadata.bind(policy)

  /**
   * @param {InstanceType<import('better-sqlite3')>} db
   */
  function writeRegionMetadata(db) {
    origGenerate(db)
    const rows = /** @type {Array<{ name: string, value: string }>} */ (
      db.prepare('SELECT name, value FROM metadata').all()
    )
    /** @type {Record<string, string>} */
    const prev = {}
    for (const r of rows) prev[r.name] = r.value
    db.exec('DELETE FROM metadata;')
    const meta = {
      name: `${policy.name ?? 'Tiles'} (region ${minzoom}-${maxzoom})`,
      format: prev.format ?? 'png',
      minzoom: String(minzoom),
      maxzoom: String(maxzoom),
      bounds: bounds.join(','),
      center,
      type: prev.type ?? 'baselayer',
      attribution: prev.attribution ?? ''
    }
    const stmt = db.prepare('INSERT INTO metadata (name, value) VALUES (?, ?)')
    for (const [k, v] of Object.entries(meta)) stmt.run(k, v)
  }

  policy.generateMetadata = writeRegionMetadata
}

for (const p of policys) {
  applyRegionOverrides(p)
}

async function run(policys) {
  for (let i = 0; i < policys.length; i++) {
    const policy = policys[i]
    console.log('当前执行任务：')
    console.log(JSON.stringify(policy, null, 2))
    const dl = new Downloader(policy)
    const levels = policy.levels

    if (checkOnly) {
      dl.initMBTiles()
      dl.checkIntegrityByLevels(levels)
      dl.db.close()
      process.exit(0)
    }

    if (repairOnly) {
      dl.initMBTiles()
      await dl.repairMissingTiles(levels, true, acceptNoTile)
      process.exit(0)
    }

    /* ====== ⭐ cursor 回退逻辑 ⭐ ====== */
    if (dl.mode === 'mbtiles' && dl.progress.cursor === null) {
      dl.initMBTiles()

      const firstMissing = dl.findFirstMissingTile(levels)

      if (firstMissing) {
        const rollbackCursor = dl.prevTile(firstMissing, levels)

        console.log('♻️ cursor rollback to', rollbackCursor ?? 'START')
        dl.progress.cursor = rollbackCursor
        dl.progress.save(rollbackCursor, [])
      }
      else {
        console.log('✅ all tiles already downloaded, nothing to do')
        dl.db.close()
        process.exit(0)
      }

      dl.db.close()
    }
    /* ====== ⭐ cursor 回退逻辑 END ⭐ ====== */

    dl.run(levels)
  }
}

run(policys)
