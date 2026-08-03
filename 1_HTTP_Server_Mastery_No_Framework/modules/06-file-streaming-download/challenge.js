const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3106;

function request({ method = "GET", path, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
        headers,
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            bytes: body.length,
            preview: body.toString("utf8", 0, Math.min(body.length, 120)),
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const file = "/download/node-streaming-guide.txt";
  const cases = [
    {
      label: "List downloadable files",
      request: { path: "/files" },
    },
    {
      label: "Full download",
      request: { path: file },
    },
    {
      label: "Range first 32 bytes",
      request: { path: file, headers: { Range: "bytes=0-31" } },
    },
    {
      label: "Range from byte 32 to end",
      request: { path: file, headers: { Range: "bytes=32-" } },
    },
    {
      label: "Suffix range last 24 bytes",
      request: { path: file, headers: { Range: "bytes=-24" } },
    },
    {
      label: "Unsatisfiable range",
      request: { path: file, headers: { Range: "bytes=999999-1000000" } },
    },
    {
      label: "Path traversal attempt",
      request: { path: "/download/..%2F..%2Fpackage.json" },
    },
  ];

  for (const item of cases) {
    const response = await request(item.request);

    console.log(`\n=== ${item.label} ===`);
    console.log(`Status: ${response.statusCode}`);
    if (response.headers["content-length"]) console.log(`Content-Length: ${response.headers["content-length"]}`);
    if (response.headers["content-range"]) console.log(`Content-Range: ${response.headers["content-range"]}`);
    if (response.headers["accept-ranges"]) console.log(`Accept-Ranges: ${response.headers["accept-ranges"]}`);
    console.log(`Bytes received: ${response.bytes}`);
    console.log(response.preview);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
