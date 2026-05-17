const https = require('https');
const { PNG } = require('pngjs');

const quadkeys = ["123120", "12310231311103"];
const itValues = ["A"]; // Only Test Annotation Only

async function testUrl(quadkey, it) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=zh-cn,en-us&ur=CN&it=${it}&og=925&n=z&o=PNG&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                let transparentRatio = "N/A";
                if (res.statusCode === 200 && buffer.length > 0) {
                    try {
                        const png = PNG.sync.read(buffer);
                        let transCount = 0;
                        for (let i = 0; i < png.data.length; i += 4) {
                            if (png.data[i + 3] < 255) transCount++;
                        }
                        transparentRatio = (transCount / (png.width * png.height)).toFixed(4);
                    } catch (e) { transparentRatio = "Error"; }
                }
                console.log(`[QK:${quadkey}][IT:${it}] Status: ${res.statusCode}, Alpha: ${transparentRatio}`);
                resolve();
            });
        }).on('error', () => resolve());
    });
}

(async () => {
    for (const qk of quadkeys) {
        await testUrl(qk, "A");
    }
})();
