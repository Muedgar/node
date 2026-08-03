const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3104;

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
    ["GET", "/users/42/files?tag=node&tag=http&page=1&limit=2&sort=size&order=desc"],
    ["GET", "/users/42/files?q=json&archived=false"],
    ["GET", "/users/42/files/f-100?download=true"],
    ["GET", "/users/42/files?page=abc"],
    ["GET", "/users/42/files?limit=99"],
    ["GET", "/users/42/files?sort=unknown"],
    ["GET", "/users/%E0%A4%A/files"],
  ];

  for (const [method, path] of cases) {
    const response = await request(method, path);

    console.log(`\n=== ${method} ${path} ===`);
    console.log(`Status: ${response.statusCode}`);
    console.log(response.body);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
