# Amazon AWS Terrarium 地形瓦片数据源说明

> 结论：`amazonaws_ter`（AWS Terrarium）地形瓦片数据源**全球最高层级为 z15，z16 起不存在**。

## 数据源概述

| 项        | 值                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------- |
| 数据源    | [AWS Open Data – Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（Mapzen Terrarium） |
| S3 Bucket | `elevation-tiles-prod`（区域 `us-east-1`，另有欧盟副本 `elevation-tiles-prod-eu`）                |
| URL 模板  | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`                         |
| 瓦片格式  | PNG（Terrarium 编码高程，RGB 各通道存储高度）                                                     |
| 层级范围  | **0 – 15**（全球统一）                                                                            |

## 层级上限探测结果

直接请求 S3 源验证，5 个地区（中国中心 104,30 / 中国西部 86,29 / 中国东部 120,32 / 美国 -105,40 / 欧洲 10,48）结果一致：

| 层级            | HTTP 状态 | 结论          |
| --------------- | --------- | ------------- |
| z13 / z14 / z15 | 200       | ✅ 瓦片存在   |
| z16 / z17 / z18 | 404       | ❌ 瓦片不存在 |

**结论：数据源最大层级 = z15（全球），无更高层级。**

## 代码中的层级定义

定义位于 `src/policy/amazonaws.mjs`（对应 npm 脚本 `download_amazonaws_ter_world` / `download_amazonaws_ter_china`）：

| 策略                            | 层级    | bbox               | 说明                 |
| ------------------------------- | ------- | ------------------ | -------------------- |
| `amazonawsTerrariumPolicyWorld` | 0 – 12  | 全球               | 已有全局 mbtiles     |
| `amazonawsTerrariumPolicyChina` | 13 – 15 | `[73, 3, 135, 54]` | **已顶到数据源上限** |

- World 策略只到 z12，但数据源实际支持到 z15（按需可扩展到 z13–15）。
- China 策略（13–15）正好覆盖数据源最高层级，无需调整。

## 区域瓦片提取工具

`scripts/extract-tiles.mjs` 可从（全球）mbtiles 中按范围提取区域瓦片，输出为新 mbtiles 或散列文件目录 `{z}/{x}/{y}.png`：

```bash
# 输出散列 PNG（范围 84.2~86.4 / 28.0~29.6）
node scripts/extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --dir ./output/region_tiles

# 输出为新 MBTiles
node scripts/extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --mbtiles ./output/region.mbtiles

# 限定层级
node scripts/extract-tiles.mjs --bbox 84.2,28.0,86.4,29.6 --min-z 13 --max-z 15 --dir ./output/region_tiles
```

说明：

- 源 mbtiles 的 `tile_row` 按 TMS 约定（y 翻转）；散列输出按 XYZ 约定（y 不翻转，便于直接供瓦片服务器使用）。
- 扩展名按源 `metadata.format` 自动识别：PNG 源输出 `.png`，矢量源（`pbf`/`mvt`）输出 `.pbf`/`.mvt`。
- 只提取与 bbox 相交的瓦片（边界瓦片整体保留）。

## 建议

### 下载指定区域的高层级（z13–15）地形

主下载器 `src/maptiles-downloader.mjs` 现支持区域/层级覆盖参数：`--bbox`、`--min-z`、`--max-z`、`--out`（支持 `--key=value` 与 `--key value` 两种写法），可将任意 `--type` 限定到指定范围。

```bash
# 1) 直接下载区域 z13–15（推荐，产出单独 mbtiles）
pnpm download_amazonaws_ter_region_13_15
# 等价于:
node ./src/maptiles-downloader.mjs \
  --type=amazonaws_ter_world \
  --bbox 84.2,28.0,86.4,29.6 \
  --min-z 13 --max-z 15 \
  --out ./output/amazonaws_ter_region_13_15.mbtiles

# 2) 或一次下载区域 z0–15（z0–12 + 13–15 合并到单个 mbtiles）
pnpm download_amazonaws_ter_region_0_15
```

说明：

- 覆盖参数会动态合成 `levels` 并自动重写 metadata（`minzoom/maxzoom/bounds/center/name`），保留原 `format/attribution/type`。
- 不传 `--out` 时自动重命名输出，避免覆盖预设 mbtiles。
- 下载器自带并发、重试、断点续传（progress）、完整性检查。

### 从已有 mbtiles 提取区域瓦片

```bash
# 按 China 策略下载（若尚未下载）
pnpm download_amazonaws_ter_china

# 从结果 mbtiles 提取所需区域
node scripts/extract-tiles.mjs \
  --src ./output/amazonaws_ter_china_13_15.mbtiles \
  --bbox 84.2,28.0,86.4,29.6 \
  --mbtiles ./output/region_ter_13_15.mbtiles
```
