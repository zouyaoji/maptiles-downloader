import fs from 'fs';
import { bboxToTileRange } from './src/utils/tile.mjs';

function getBBox(geojson) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const coords = [];
  
  const extract = (obj) => {
    if (!obj) return;
    if (Array.isArray(obj)) {
      if (typeof obj[0] === 'number') {
        coords.push(obj);
      } else {
        obj.forEach(extract);
      }
    } else if (obj.type === 'FeatureCollection') {
      obj.features.forEach(f => extract(f.geometry));
    } else if (obj.type === 'Feature') {
      extract(obj.geometry);
    } else if (obj.coordinates) {
      extract(obj.coordinates);
    } else if (obj.geometries) {
      obj.geometries.forEach(extract);
    }
  };
  
  extract(geojson);
  coords.forEach(([lon, lat]) => {
    if (lon < minX) minX = lon;
    if (lon > maxX) maxX = lon;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  });
  return [minX, minY, maxX, maxY];
}

const pakGeo = JSON.parse(fs.readFileSync('bounds/巴基斯坦(1).geojson', 'utf8'));
const ksmGeo = JSON.parse(fs.readFileSync('bounds/克什米尔地区(1).geojson', 'utf8'));

const pakBbox = getBBox(pakGeo);
const ksmBbox = getBBox(ksmGeo);

console.log('Pakistan BBox:', pakBbox);
console.log('Kashmir BBox:', ksmBbox);

let totalTiles = 0;

// z0-z5: Global
for (let z = 0; z <= 5; z++) {
  const n = 1 << z;
  totalTiles += n * n;
}

// z6-z14: Pakistan BBox
for (let z = 6; z <= 14; z++) {
  const range = bboxToTileRange(pakBbox, z);
  totalTiles += (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
}

// z15-z17: Kashmir BBox
for (let z = 15; z <= 17; z++) {
  const range = bboxToTileRange(ksmBbox, z);
  totalTiles += (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
}

console.log('Total Tiles:', totalTiles);
console.log('Estimated Sizes:');
console.log('  50KB:', (totalTiles * 50 / 1024 / 1024).toFixed(2), 'GB');
console.log(' 100KB:', (totalTiles * 100 / 1024 / 1024).toFixed(2), 'GB');
console.log(' 150KB:', (totalTiles * 150 / 1024 / 1024).toFixed(2), 'GB');
