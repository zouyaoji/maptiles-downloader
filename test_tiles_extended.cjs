const https = require('https');
const { PNG } = require('pngjs');

const quadkeys = ["123120", "12310231311103"];
const paramSets = [
    { name: "A", params: "?mkt=zh-cn,en-us&ur=CN&it=L&og=925&n=z&o=PNG&sv=9.43" },
    { name: "B", params: "?mkt=zh-cn,en-us&ur=CN&it=G,BX,L&og=925&n=z&o=PNG&sv=9.43" },
    { name: "C", params: "?mkt=en-us,ur-pk&ur=PK&it=L&og=925&n=z&o=PNG&sv=9.43" },
    { name: "D", params: "?mkt=en-us,ur-pk&ur=PK&it=G,BX,L&og=925&n=z&o=PNG&sv=9.43" },
    { name: "E", params: "?mkt=en-us,ur-pk&ur=PK&it=L,RL&og=925&n=z&o=PNG&sv=9.43" },
    { name: "F", params: "?mkt=en-us,ur-pk&ur=PK&it=RL&og=925&n=z&o=PNG&sv=9.43" }
];

async function testUrl(quadkey, set) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}${set.params}`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers['content-type'];
                const tileInfo = res.headers['x-ve-tile-info'] || 'N/A';
                
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
                
                console.log(`[${quadkey}][${set.name}] Status: ${res.statusCode}, Size: ${buffer.length}, AlphaRatio: ${transparentRatio}, Info: ${tileInfo}`);
                resolve();
            });
        }).on('error', (e) => {
            console.log(`[${quadkey}][${set.name}] Network Error: ${e.message}`);
            resolve();
        });
    });
}

(async () => {
    for (const qk of quadkeys) {
        console.log(`\n--- Testing Quadkey: ${qk} ---`);
        for (const set of paramSets) {
            await testUrl(qk, set);
        }
    }
})();
