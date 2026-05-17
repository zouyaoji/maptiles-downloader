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

async function testUrl(quadkey, it, mkt, ur) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=${mkt}&ur=${ur}&it=${it}&og=925&n=z&o=PNG&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const ct = res.headers['content-type'] || 'none';
                let alpha = "N/A";
                if (res.statusCode === 200 && ct.includes('image/png')) {
                    alpha = await checkAlpha(buffer);
                }
                console.log(`[QK:${quadkey}][IT:${it.padEnd(7)}][${ur}] Status: ${res.statusCode}, Alpha: ${alpha}, CT: ${ct}`);
                resolve();
            });
        }).on('error', () => resolve());
    });
}
(async () => {
    const qks = ["123120", "12310231311103"];
    const tests = [
        {it: "L", mkt: "zh-cn,en-us", ur: "CN"},
        {it: "G,BX,L", mkt: "zh-cn,en-us", ur: "CN"},
        {it: "L", mkt: "en-us,ur-pk", ur: "PK"},
        {it: "G,BX,L", mkt: "en-us,ur-pk", ur: "PK"},
        {it: "L,RL", mkt: "en-us,ur-pk", ur: "PK"},
        {it: "RL", mkt: "en-us,ur-pk", ur: "PK"}
    ];
    for (const qk of qks) {
        for (const t of tests) {
            await testUrl(qk, t.it, t.mkt, t.ur);
        }
    }
})();
