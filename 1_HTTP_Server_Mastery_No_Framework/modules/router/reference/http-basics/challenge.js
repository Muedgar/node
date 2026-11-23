const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3101;

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
  const cases = [
    {
      label: "GET health check",
      request: {
        method: "GET",
        path: "/health",
      },
    },
    {
      label: "POST text body to inspector",
      request: {
        method: "POST",
        path: "/inspect?source=challenge&level=hard",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Lesson": "raw-http",
        },
        body: "hello from a pure node client",
      },
    },
    {
      label: "PUT JSON body to inspector",
      request: {
        method: "PUT",
        path: "/inspect?format=json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: "streams", mastered: false }),
      },
    },
    {
      label: "Unknown route",
      request: {
        method: "GET",
        path: "/missing",
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
