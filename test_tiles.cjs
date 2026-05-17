const https = require('https');
const { PNG } = require('pngjs');

const urls = [
    "https://dynamic.t0.tiles.ditu.live.com/comp/ch/12310231311103?mkt=en-us,ur-pk&ur=PK&it=A,L&og=925&n=z&sv=9.43",
    "https://dynamic.t0.tiles.ditu.live.com/comp/ch/12310231311103?mkt=en-us,ur-pk&ur=PK&it=L&og=925&n=z&o=PNG&sv=9.43",
    "https://dynamic.t0.tiles.ditu.live.com/comp/ch/12310231311103?mkt=en-us,ur-pk&ur=PK&it=G,BX,L&og=925&n=z&o=PNG&sv=9.43",
    "https://dynamic.t0.tiles.ditu.live.com/comp/ch/12310231311103?mkt=en-us,ur-pk&ur=PK&it=G,L&og=925&n=z&o=PNG&sv=9.43",
    "https://dynamic.t0.tiles.ditu.live.com/comp/ch/12310231311103?mkt=en-us,ur-pk&ur=PK&it=G,BX&og=925&n=z&o=PNG&sv=9.43"
];

async function testUrl(url, index) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers['content-type'];
                const tileInfo = res.headers['x-ve-tile-info'];
                console.log(`\n[URL ${index + 1}] ${url}`);
                console.log(`Status: ${res.statusCode}, Content-Type: ${contentType}, Size: ${buffer.length}, x-ve-tile-info: ${tileInfo}`);

                let transparentRatio = null;
                let fullyTransparentRatio = null;

                if (contentType && contentType.includes('image/png') && buffer.length > 0) {
                    try {
                        const png = PNG.sync.read(buffer);
                        let transCount = 0;
                        let fullyTransCount = 0;
                        const totalPixels = png.width * png.height;
                        for (let i = 0; i < png.data.length; i += 4) {
                            const alpha = png.data[i + 3];
                            if (alpha < 255) transCount++;
                            if (alpha === 0) fullyTransCount++;
                        }
                        transparentRatio = (transCount / totalPixels).toFixed(4);
                        fullyTransparentRatio = (fullyTransCount / totalPixels).toFixed(4);
                        console.log(`Alpha < 255 Ratio: ${transparentRatio}, Alpha == 0 Ratio: ${fullyTransparentRatio}`);
                        console.log(`Dimensions: ${png.width}x${png.height}`);
                    } catch (e) {
                        console.log(`Error parsing PNG: ${e.message}`);
                    }
                }
                
                let type = "Unknown";
                if (res.statusCode === 200) {
                    if (transparentRatio !== null) {
                        type = parseFloat(transparentRatio) > 0.5 ? "透明叠加层 (Overlay)" : "不透明底图 (Base)";
                    } else if (contentType && contentType.includes('image/jpeg')) {
                        type = "不透明底图 (Base)";
                    }
                } else {
                    type = `HTTP ${res.statusCode}`;
                }
                
                resolve({ index: index + 1, type });
            });
        }).on('error', (e) => {
            console.error(`Error URL ${index + 1}: ${e.message}`);
            resolve({ index: index + 1, type: "Network Error" });
        });
    });
}

(async () => {
    const results = [];
    for (let i = 0; i < urls.length; i++) {
        results.push(await testUrl(urls[i], i));
    }
    console.log("\n--- Final Conclusion ---");
    results.forEach(r => console.log(`URL ${r.index}: ${r.type}`));
})();
