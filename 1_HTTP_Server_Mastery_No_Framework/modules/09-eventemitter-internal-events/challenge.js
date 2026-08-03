const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3109;

function request({ method = "GET", path, body }) {
  const payload = body === undefined ? "" : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
        headers: payload
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
            }
          : {},
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            statusCode: res.statusCode,
            body: text,
            json: JSON.parse(text),
          });
        });
      }
    );

    req.on("error", reject);
    req.end(payload);
  });
}

async function runCase(label, options) {
  const response = await request(options);

  console.log(`\n=== ${label} ===`);
  console.log(`Status: ${response.statusCode}`);
  console.log(response.body);

  return response.json;
}

async function main() {
  await runCase("Initial audit log", {
    path: "/audit-log",
  });

  await runCase("Login emits auth.login", {
    method: "POST",
    path: "/auth/login",
    body: { email: "event@example.com" },
  });

  const uploaded = await runCase("Upload emits file.uploaded", {
    method: "POST",
    path: "/files",
    body: { name: "events.txt", size: 512 },
  });

  await runCase("Delete emits file.deleted", {
    method: "DELETE",
    path: `/files/${uploaded.file.id}`,
  });

  await runCase("Explode emits server.error", {
    method: "POST",
    path: "/explode",
  });

  await runCase("Final audit log", {
    path: "/audit-log",
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
