const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3114;

function request({ method = "GET", path, body, headers = {} }) {
  const payload = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
        headers: {
          "X-Forwarded-For": headers["X-Forwarded-For"] || "203.0.113.14",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
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
    req.end(payload);
  });
}

async function logCase(label, options) {
  const response = await request(options);
  console.log(`\n=== ${label} ===`);
  console.log(`Status: ${response.statusCode}`);
  console.log(`X-Request-ID: ${response.headers["x-request-id"]}`);
  console.log(`RateLimit-Remaining: ${response.headers["ratelimit-remaining"]}`);
  if (response.headers["retry-after"]) console.log(`Retry-After: ${response.headers["retry-after"]}`);
  console.log(`X-Content-Type-Options: ${response.headers["x-content-type-options"]}`);
  console.log(response.body);
  return response;
}

async function main() {
  await logCase("Health with custom request id", {
    path: "/health",
    headers: { "X-Request-ID": "module14-demo-id", "X-Forwarded-For": "203.0.113.20" },
  });

  await logCase("Echo valid JSON", {
    method: "POST",
    path: "/echo",
    body: { hello: "secure node" },
    headers: { "X-Forwarded-For": "203.0.113.21" },
  });

  await logCase("Invalid JSON", {
    method: "POST",
    path: "/echo",
    body: "{bad",
    headers: { "X-Forwarded-For": "203.0.113.22" },
  });

  await logCase("Safe 500 error", {
    path: "/boom",
    headers: { "X-Forwarded-For": "203.0.113.23" },
  });

  for (let i = 1; i <= 6; i++) {
    await logCase(`Rate limit attempt ${i}`, {
      path: "/health",
      headers: { "X-Forwarded-For": "198.51.100.77" },
    });
  }

  await logCase("Access logs", {
    path: "/logs",
    headers: { "X-Forwarded-For": "203.0.113.24" },
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
