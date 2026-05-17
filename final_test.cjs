const https = require('https');
async function testUrl(quadkey, it, mkt, ur) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=${mkt}&ur=${ur}&it=${it}&og=925&n=z&o=PNG&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const ct = res.headers['content-type'] || 'none';
                console.log(`[QK:${quadkey}][IT:${it}][${ur}] Status: ${res.statusCode}, CT: ${ct}, Size: ${buffer.length}`);
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
