const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3105;

function multipartBody(boundary, parts) {
  const chunks = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));

    const disposition = [
      `form-data; name="${part.name}"`,
      part.filename ? `filename="${part.filename}"` : null,
    ].filter(Boolean).join("; ");

    chunks.push(Buffer.from(`Content-Disposition: ${disposition}\r\n`));

    if (part.contentType) {
      chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n`));
    }

    chunks.push(Buffer.from("\r\n"));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(String(part.value)));
    chunks.push(Buffer.from("\r\n"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function request({ method, path, headers = {}, body = Buffer.alloc(0) }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
        headers: {
          "Content-Length": body.length,
          ...headers,
        },
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", reject);
    req.end(body);
  });
}

async function main() {
  const boundary = "----pure-node-boundary-05";
  const validBody = multipartBody(boundary, [
    { name: "title", value: "Pure Node multipart upload" },
    { name: "tag", value: "node" },
    { name: "tag", value: "multipart" },
    {
      name: "files",
      filename: "../notes one.txt",
      contentType: "text/plain",
      value: "hello from file one",
    },
    {
      name: "files",
      filename: "data.json",
      contentType: "application/json",
      value: JSON.stringify({ ok: true, module: 5 }),
    },
  ]);

  const oversizedFileBody = multipartBody(boundary, [
    {
      name: "files",
      filename: "too-large.txt",
      contentType: "text/plain",
      value: "x".repeat(1_200),
    },
  ]);

  const cases = [
    {
      label: "Valid multipart with fields and two files",
      request: {
        method: "POST",
        path: "/upload",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: validBody,
      },
    },
    {
      label: "Wrong content type",
      request: {
        method: "POST",
        path: "/upload",
        headers: { "Content-Type": "application/json" },
        body: Buffer.from("{}"),
      },
    },
    {
      label: "Missing boundary",
      request: {
        method: "POST",
        path: "/upload",
        headers: { "Content-Type": "multipart/form-data" },
        body: validBody,
      },
    },
    {
      label: "Oversized file",
      request: {
        method: "POST",
        path: "/upload",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: oversizedFileBody,
      },
    },
  ];

  for (const item of cases) {
    const response = await request(item.request);

    console.log(`\n=== ${item.label} ===`);
    console.log(`Status: ${response.statusCode}`);
    console.log(response.body);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
