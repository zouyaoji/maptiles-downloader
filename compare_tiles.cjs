const https = require('https');
const crypto = require('crypto');
const { PNG } = require('pngjs');

async function download(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status: ${res.statusCode}`));
                return;
            }
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

async function analyzePng(name, buffer) {
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    console.log(`--- Analysis for ${name} ---`);
    console.log(`Size: ${buffer.length} bytes`);
    console.log(`MD5: ${hash}`);

    try {
        const png = PNG.sync.read(buffer);
        console.log(`Dimensions: ${png.width}x${png.height}`);
        console.log(`ColorType: ${png.colorType}, BitDepth: ${png.bitDepth}`);

        let alpha0 = 0, alphaLT128 = 0, alpha255 = 0;
        let pureWhite = 0, grayScale = 0;
        const totalPixels = png.width * png.height;

        for (let i = 0; i < png.data.length; i += 4) {
            const r = png.data[i];
            const g = png.data[i + 1];
            const b = png.data[i + 2];
            const a = png.data[i + 3];

            if (a === 0) alpha0++;
            if (a < 128) alphaLT128++;
            if (a === 255) alpha255++;
            if (r === 255 && g === 255 && b === 255) pureWhite++;
            if (r === g && g === b) grayScale++;
        }

        console.log(`Alpha: 0=${alpha0}, <128=${alphaLT128}, 255=${alpha255}`);
        console.log(`Pure White (RGB 255): ${pureWhite}`);
        console.log(`Grayscale (R=G=B) Ratio: ${(grayScale / totalPixels * 100).toFixed(2)}%`);

        let first10 = [];
        for (let i = 0; i < 10 && i < totalPixels; i++) {
            const idx = i * 4;
            first10.push(`[${png.data[idx]},${png.data[idx+1]},${png.data[idx+2]},${png.data[idx+3]}]`);
        }
        console.log(`First 10 pixels (RGBA): ${first10.join(' ')}`);
    } catch (e) {
        console.error(`Failed to parse PNG: ${e.message}`);
    }
    console.log('');
    return hash;
}

async function run() {
    const urls = {
        FOREGROUND: "https://ecn.t0.tiles.virtualearth.net/tiles/r123120.png?g=7000&mapLayer=Foreground&mkt=en-PK",
        BACKGROUND: "https://ecn.t0.tiles.virtualearth.net/tiles/r123120.png?g=7000&mapLayer=Background&mkt=en-PK",
        BASEMAP: "https://ecn.t0.tiles.virtualearth.net/tiles/r123120.png?g=7000&mkt=en-PK"
    };

    const hashes = {};
    for (const [name, url] of Object.entries(urls)) {
        try {
            const buf = await download(url);
            hashes[name] = await analyzePng(name, buf);
        } catch (e) {
            console.error(`Error processing ${name}: ${e.message}`);
        }
    }

    console.log("--- MD5 Comparison ---");
    console.log(`FOREGROUND vs BACKGROUND: ${hashes.FOREGROUND === hashes.BACKGROUND}`);
    console.log(`FOREGROUND vs BASEMAP: ${hashes.FOREGROUND === hashes.BASEMAP}`);
    console.log(`BACKGROUND vs BASEMAP: ${hashes.BACKGROUND === hashes.BASEMAP}`);
}

run();
