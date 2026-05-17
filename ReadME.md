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
