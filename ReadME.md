# Maptiles Downloader

用于批量下载在线瓦片并写入 MBTiles，支持断点续跑、完整性检查和缺失修复。

## 快速开始

1. 安装依赖

pnpm install

2. 按类型下载

pnpm run download_amazonaws_ter_world

## 新增 Amazon 地形瓦片配置

数据源 URL 模板：
https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png

可用类型：

- amazonaws_ter_world：全球 0-12
- amazonaws_ter_china：中国 13-15（bbox: 73,3,135,54）

对应 npm scripts：

- pnpm run download_amazonaws_ter_world
- pnpm run download_amazonaws_ter_china

## 通用命令

也可直接使用入口脚本：

node ./src/maptiles-downloader.mjs --type=amazonaws_ter_world
node ./src/maptiles-downloader.mjs --type=amazonaws_ter_china

## 所有支持的下载类型

MSN：

- msn_street_world
- msn_street_china
- msn_street_province
- msn_image_world
- msn_image_china
- msn_image_pakistan
- msn_image_shaoguan（韶关影像，13-14 层）
- msn_image_province
- msn_shadow_world
- msn_shadow_china
- msn_shadow_province

天地图：

- tianditu_vec_w_world
- tianditu_vec_w_china
- tianditu_vec_w_province
- tianditu_img_w_world
- tianditu_img_w_china
- tianditu_img_w_province
- tianditu_ter_w_world
- tianditu_ter_w_china
- tianditu_ter_w_province

Amazon AWS Terrarium：

- amazonaws_ter_world
- amazonaws_ter_china

## 检查与修复

完整性检查（不下载）：

node ./src/maptiles-downloader.mjs --type=amazonaws_ter_world --check-only

修复缺失瓦片：

node ./src/maptiles-downloader.mjs --type=amazonaws_ter_world --repair-only

## 输出文件

默认输出到 output 目录，包括：

- .mbtiles 文件
- .progress.json 进度文件

## MSN 影像说明

MSN 影像图层已接入，类型如下：

- msn_image_world
- msn_image_china
- msn_image_province

对应 npm scripts：

- pnpm run download_msn_image_world
- pnpm run download_msn_image_china
- pnpm run download_msn_image_pakistan
- pnpm run download_msn_image_province

也可直接使用入口脚本：

node ./src/maptiles-downloader.mjs --type=msn_image_world
node ./src/maptiles-downloader.mjs --type=msn_image_china
node ./src/maptiles-downloader.mjs --type=msn_image_pakistan
node ./src/maptiles-downloader.mjs --type=msn_image_province

说明：MSN 影像使用 `it=A` 的简化参数，返回 JPEG 影像瓦片；这是一层纯影像底图，不带标注。

## 韶关影像下载 + 合并 TIF

韶关影像只需下载 13/14 两层（bbox 由 `bounds/韶关.geojson` 外包矩形外扩 0.2° 得到，
保证覆盖整个韶关）：

pnpm run download_msn_image_shaoguan

# 等价于：node ./src/maptiles-downloader.mjs --type=msn_image_shaoguan

下载完成后把瓦片合并成单张 GeoTIFF（默认取最高层 14，EPSG:3857，流式写入低内存）：

pnpm run merge_msn_image_shaoguan

# 等价于：node ./src/maptiles-to-tif.mjs --mbtiles=./output/msn_image_shaoguan_13_14.mbtiles --out=./output/msn_image_shaoguan.tif --zoom=14

也可以一条命令「下载 + 合并」：

pnpm run download_merge_msn_image_shaoguan

合并脚本 maptiles-to-tif.mjs 常用参数：

- --zoom=14 只输出 z14 单图（默认，最通用）；--zoom=13,14 把两层写进同一文件（多 IFD，14 主图 + 13 overview）
- --bbox=w,s,e,n 覆盖范围，默认读取 mbtiles 元数据里的 bounds
- --compression=none|deflate 压缩方式，默认 deflate（体积小）
- --verify 写完后自校验（结构 + 首 strip 像素对比）

注意：z14 全图约 27136×26112 像素（约 709 MP），合并时逐 strip 处理，内存占用很低。
需要 z13 单图时用 --zoom=13。

### 有云区域的备选数据源

Bing/MSN 影像是单一镶嵌影像，没有历史时相可选。如果某片区域正好有云，
可用天地图影像（不同卫星影像拼接、时相不同，且为 CGCS2000≈WGS84 无偏移）：

pnpm run download_tianditu_img_w_shaoguan
pnpm run merge_tianditu_img_w_shaoguan

# 或一条命令

pnpm run download_merge_tianditu_img_w_shaoguan

若两种数据源同一位置都有云，就需要真正的多时相无云影像（如 Sentinel-2 合成），
需要额外接入 Sentinel Hub / AWS 开放数据等，可按需再加。
