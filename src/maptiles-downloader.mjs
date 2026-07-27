import process from 'node:process'
import Downloader from './core/Downloader.mjs'
import { amazonawsTerrariumPolicyChina, amazonawsTerrariumPolicyWorld } from './policy/amazonaws.mjs'
import { msnImageMapPolicyChina, msnImageMapPolicyPakistan, msnImageMapPolicyProvince, msnImageMapPolicyWorld, msnImageMapPolicyYilong, msnShadowMapPolicyChina, msnShadowMapPolicyProvince, msnShadowMapPolicyWorld, msnStreetMapPolicyChina, msnStreetMapPolicyProvince, msnStreetMapPolicyWorld } from './policy/msn.mjs'
import { tiandituCiaPolicyPakistan, tiandituImgPolicyChina, tiandituImgPolicyProvince, tiandituImgPolicyWorld, tiandituTerPolicyChina, tiandituTerPolicyWorld, tiandituVecPolicyChina, tiandituVecPolicyProvince, tiandituVecPolicyWorld } from './policy/tianditu.mjs'

const checkOnly = process.argv.includes('--check-only')
const repairOnly = process.argv.includes('--repair-only')
const acceptNoTile = process.argv.includes('--accept-no-tile')

function parseArgs() {
  const args = process.argv.slice(2)
  const params = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const [key, value] = args[i].substring(2).split('=')
      params[key] = value || true // 如果没有值，设为 true
    }
  }

  return params
}

const policys = []

const args = parseArgs()
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
