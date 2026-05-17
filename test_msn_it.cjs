const https = require("https");

const quadkey = "12312030";
const itValues = [
    "A,L",
    "A,G,L",
    "A,G,BX,L",
    "A,BX,L",
    "A,G"
];

async function testUrl(itValue) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=en-us,ur-pk&ur=PK&it=${itValue}&og=925&n=z&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let dataLen = 0;
            const contentType = res.headers["content-type"] || "unknown";
            const chunks = [];
            
            res.on("data", (chunk) => {
                dataLen += chunk.length;
                chunks.push(chunk);
            });
            
            res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                let format = "unknown";
                if (buffer.length > 4) {
                    if (buffer[0] === 0xFF && buffer[1] === 0xD8) format = "JPEG";
                    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) format = "PNG";
                }
                
                console.log(`it=${itValue.padEnd(10)} | Status: ${res.statusCode} | Size: ${String(dataLen).padStart(6)} | Type: ${contentType.split(";")[0].padEnd(12)} | Format: ${format}`);
                resolve();
            });
        }).on("error", (err) => {
            console.log(`it=${itValue.padEnd(10)} | Error: ${err.message}`);
            resolve();
        });
    });
}

async function run() {
    console.log(`Testing quadkey: ${quadkey}\n`);
    for (const it of itValues) {
        await testUrl(it);
    }
}

run();
