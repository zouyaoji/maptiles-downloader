const https = require('https');
const { PNG } = require('pngjs');

const quadkeys = ["123120", "12310231311103"];
const itValues = ["A"];

async function testUrl(quadkey, it) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=zh-cn,en-us&ur=CN&it=${it}&og=925&n=z&o=PNG&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers['content-type'];
                console.log(`[QK:${quadkey}][IT:${it}] Status: ${res.statusCode}, CT: ${contentType}, Size: ${buffer.length}`);
                if (res.statusCode === 200 && contentType.includes('image/png')) {
                    try {
                        const png = PNG.sync.read(buffer);
                        let transCount = 0;
                        for (let i = 0; i < png.data.length; i += 4) {
                            if (png.data[i + 3] < 255) transCount++;
                        }
                        console.log(`Alpha: ${(transCount / (png.width * png.height)).toFixed(4)}`);
                    } catch (e) { console.log("PNG Read Error"); }
                }
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
