const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3102;

function request(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
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
    req.end();
  });
}

async function main() {
  const cases = [
    ["GET", "/health"],
    ["GET", "/users/42"],
    ["GET", "/users/42/files/report%202026.pdf?download=true&tag=node&tag=http"],
    ["POST", "/users/42/files"],
    ["PATCH", "/users/42/files/report.pdf"],
    ["GET", "/projects/unknown"],
  ];

  for (const [method, path] of cases) {
    const response = await request(method, path);

    console.log(`\n=== ${method} ${path} ===`);
    console.log(`Status: ${response.statusCode}`);
    if (response.headers.allow) console.log(`Allow: ${response.headers.allow}`);
    console.log(response.body);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
