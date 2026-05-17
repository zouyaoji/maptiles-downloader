const https = require('https');
const { PNG } = require('pngjs');

async function checkAlpha(buffer) {
    try {
        const png = PNG.sync.read(buffer);
        let transCount = 0;
        for (let i = 0; i < png.data.length; i += 4) {
            if (png.data[i + 3] < 255) transCount++;
        }
        return (transCount / (png.width * png.height)).toFixed(4);
    } catch (e) { return "Error"; }
}

async function testUrl(quadkey, it) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=zh-cn,en-us&ur=CN&it=${it}&og=925&n=z&o=PNG&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const ct = res.headers['content-type'] || 'none';
                let alpha = "N/A";
                if (res.statusCode === 200 && (ct.includes('image/png') || ct.includes('image/gif'))) {
                    alpha = await checkAlpha(buffer);
                }
                console.log(`[QK:${quadkey}][IT:${it.padEnd(5)}] Status: ${res.statusCode}, Alpha: ${alpha}, CT: ${ct}`);
                resolve();
            });
        }).on('error', () => resolve());
    });
}
(async () => {
    const qks = ["123120", "12310231311103"];
    // A: Annotations, G: Ground (Map), BX: Building? L: Labels?
    // Testing purely labels/roads without background
    const its = ["A", "L", "RL", "A,L", "A,RL"];
    for (const qk of qks) {
        for (const it of its) {
            await testUrl(qk, it);
        }
    }
})();
