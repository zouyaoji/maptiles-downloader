const https = require('https');
const { PNG } = require('pngjs');

const quadkeys = ["123120", "12310231311103"];
const itValues = ["L", "G,L", "G,BX,L", "A,L", "L,RL", "RL"];
const mktUrPairs = [
    { mkt: "zh-cn,en-us", ur: "CN" },
    { mkt: "en-us,ur-pk", ur: "PK" }
];

async function testUrl(quadkey, it, mkt, ur) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=${mkt}&ur=${ur}&it=${it}&og=925&n=z&o=PNG&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers['content-type'];
                
                let transparentRatio = "N/A";
                if (res.statusCode === 200 && contentType && contentType.includes('image/png') && buffer.length > 0) {
                    try {
                        const png = PNG.sync.read(buffer);
                        let transCount = 0;
                        const totalPixels = png.width * png.height;
                        for (let i = 0; i < png.data.length; i += 4) {
                            if (png.data[i + 3] < 255) transCount++;
                        }
                        transparentRatio = (transCount / totalPixels).toFixed(4);
                    } catch (e) {
                        transparentRatio = "Error";
                    }
                }
                
                console.log(`[QK:${quadkey}][IT:${it.padEnd(8)}][${ur}] Status: ${res.statusCode}, Alpha: ${transparentRatio}`);
                resolve();
            });
        }).on('error', (e) => {
            resolve();
        });
    });
}

(async () => {
    for (const qk of quadkeys) {
        console.log(`\n--- Quadkey: ${qk} ---`);
        for (const pair of mktUrPairs) {
            for (const it of itValues) {
                await testUrl(qk, it, pair.mkt, pair.ur);
            }
        }
    }
})();
