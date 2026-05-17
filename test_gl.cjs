const https = require("https");
const { PNG } = require("pngjs");

const quadkey = "12312030";
const tests = [
    { it: "G,L", label: "it=G,L" },
    { it: "G,L&o=PNG", label: "it=G,L&o=PNG" },
    { it: "G", label: "it=G" }
];

async function testUrl(test) {
    const url = `https://dynamic.t0.tiles.ditu.live.com/comp/ch/${quadkey}?mkt=en-us,ur-pk&ur=PK&it=${test.it}&og=925&n=z&sv=9.43`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", async () => {
                const buffer = Buffer.concat(chunks);
                const statusCode = res.statusCode;
                const size = buffer.length;
                let format = "unknown";
                if (buffer.length > 4) {
                    if (buffer[0] === 0xFF && buffer[1] === 0xD8) format = "JPEG";
                    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) format = "PNG";
                }

                let alphaInfo = "";
                if (format === "PNG") {
                    try {
                        const png = PNG.sync.read(buffer);
                        let transparentPixels = 0;
                        for (let i = 0; i < png.data.length; i += 4) {
                            if (png.data[i + 3] === 0) {
                                transparentPixels++;
                            }
                        }
                        const totalPixels = png.width * png.height;
                        const ratio = ((transparentPixels / totalPixels) * 100).toFixed(2);
                        alphaInfo = ` | Alpha=0: ${transparentPixels}/${totalPixels} (${ratio}%)`;
                    } catch (e) {
                        alphaInfo = ` | Alpha Error: ${e.message}`;
                    }
                }

                console.log(`Label: ${test.label.padEnd(12)} | Status: ${statusCode} | Size: ${String(size).padStart(6)} | Format: ${format.padEnd(5)}${alphaInfo}`);
                resolve();
            });
        }).on("error", (err) => {
            console.log(`Label: ${test.label.padEnd(12)} | Error: ${err.message}`);
            resolve();
        });
    });
}

async function run() {
    console.log(`Testing quadkey: ${quadkey}\n`);
    for (const test of tests) {
        await testUrl(test);
    }
}

run();
