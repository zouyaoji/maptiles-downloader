const https = require('https');
const { PNG } = require('pngjs');

async function checkAlpha(buffer) {
    try {
        const png = PNG.sync.read(buffer);
        let transCount = 0;
        let fullTransCount = 0;
        const total = png.width * png.height;
        for (let i = 0; i < png.data.length; i += 4) {
            const alpha = png.data[i + 3];
            if (alpha < 255) transCount++;
            if (alpha === 0) fullTransCount++;
        }
        return {
            alphaRatio: (transCount / total * 100).toFixed(2) + '%',
            fullTransRatio: (fullTransCount / total * 100).toFixed(2) + '%'
        };
    } catch (e) {
        return { alphaRatio: "Error", fullTransRatio: "Error" };
    }
}

async function testUrl(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const ct = res.headers['content-type'] || 'none';
                const size = buffer.length;
                let alphaInfo = { alphaRatio: "N/A", fullTransRatio: "N/A" };
                
                if (res.statusCode === 200 && ct.includes('image/png')) {
                    alphaInfo = await checkAlpha(buffer);
                }
                
                console.log(`URL: ${url}`);
                console.log(`Status: ${res.statusCode}, CT: ${ct}, Size: ${size} bytes`);
                console.log(`Alpha (<255): ${alphaInfo.alphaRatio}, Full Transparent (0): ${alphaInfo.fullTransRatio}`);
                console.log('------------------------------------------------------------');
                resolve();
            });
        }).on('error', (err) => {
            console.log(`URL: ${url} - Error: ${err.message}`);
            resolve();
        });
    });
}

(async () => {
    const urls = [
        "https://ecn.t0.tiles.virtualearth.net/tiles/r123120.png?g=7000&mapLayer=Foreground&mkt=en-PK",
        "https://ecn.t0.tiles.virtualearth.net/tiles/r123120.png?g=7000&mapLayer=Background&mkt=en-PK",
        "https://ecn.t0.tiles.virtualearth.net/tiles/r123120.png?g=7000&mapLayer=Basemap&mkt=en-PK",
        "https://ecn.t0.tiles.virtualearth.net/tiles/r123120.png?g=7000&mkt=en-PK",
        "https://t.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/123120?mkt=en-us&ur=PK&it=G,BX,L&og=925&n=z&o=PNG&sv=9.43",
        "https://t.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/123120?mkt=en-us&ur=PK&it=L&og=925&n=z&o=PNG&sv=9.43"
    ];
    for (const url of urls) {
        await testUrl(url);
    }
})();
