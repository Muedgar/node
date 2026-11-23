const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3103;

function request({ method, path, headers = {}, body = "" }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
        headers: {
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
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
  const largePayload = JSON.stringify({
    message: "x".repeat(700),
  });

  const cases = [
    {
      label: "Valid nested JSON",
      request: {
        method: "POST",
        path: "/echo-json",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          user: { id: 42, roles: ["admin", "student"] },
          active: true,
        }),
      },
    },
    {
      label: "Empty JSON body allowed",
      request: {
        method: "POST",
        path: "/echo-json",
        headers: { "Content-Type": "application/json" },
      },
    },
    {
      label: "Empty JSON body rejected",
      request: {
        method: "POST",
        path: "/required-json",
        headers: { "Content-Type": "application/json" },
      },
    },
    {
      label: "Wrong content type",
      request: {
        method: "POST",
        path: "/echo-json",
        headers: { "Content-Type": "text/plain" },
        body: "hello",
      },
    },
    {
      label: "Malformed JSON",
      request: {
        method: "POST",
        path: "/echo-json",
        headers: { "Content-Type": "application/json" },
        body: '{"broken": true',
      },
    },
    {
      label: "Oversized JSON",
      request: {
        method: "POST",
        path: "/echo-json",
        headers: { "Content-Type": "application/json" },
        body: largePayload,
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
