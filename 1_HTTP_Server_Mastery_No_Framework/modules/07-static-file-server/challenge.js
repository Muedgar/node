const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3107;

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
  const index = await request({ path: "/static/" });
  const css = await request({ path: "/static/styles.css" });

  const cases = [
    ["Directory index", index],
    ["CSS asset", css],
    ["JS asset", await request({ path: "/static/app.js" })],
    ["Nested text file", await request({ path: "/static/docs/readme.txt" })],
    ["Conditional 304", await request({ path: "/static/styles.css", headers: { "If-None-Match": css.headers.etag || "no-match" } })],
    ["HEAD request", await request({ method: "HEAD", path: "/static/app.js" })],
    ["Missing file", await request({ path: "/static/missing.txt" })],
    ["Traversal attempt", await request({ path: "/static/..%2F..%2Fpackage.json" })],
    ["Wrong method", await request({ method: "POST", path: "/static/app.js" })],
  ];

  for (const [label, response] of cases) {
    console.log(`\n=== ${label} ===`);
    console.log(`Status: ${response.statusCode}`);
    if (response.headers["content-type"]) console.log(`Content-Type: ${response.headers["content-type"]}`);
    if (response.headers["cache-control"]) console.log(`Cache-Control: ${response.headers["cache-control"]}`);
    if (response.headers.etag) console.log(`ETag: ${response.headers.etag}`);
    if (response.headers.allow) console.log(`Allow: ${response.headers.allow}`);
    console.log(`Bytes received: ${response.bytes}`);
    if (response.preview) console.log(response.preview);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
