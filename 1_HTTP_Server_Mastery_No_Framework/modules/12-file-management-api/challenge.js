const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3112;

function createCookieJar() {
  const cookies = new Map();
  return {
    set(headers) {
      for (const header of Array.isArray(headers) ? headers : headers ? [headers] : []) {
        const [pair] = header.split(";");
        const index = pair.indexOf("=");
        if (index !== -1) cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
    },
    header() {
      return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    },
  };
}

function multipart(boundary, parts) {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    const disposition = [`form-data; name="${part.name}"`, part.filename ? `filename="${part.filename}"` : null].filter(Boolean).join("; ");
    chunks.push(Buffer.from(`Content-Disposition: ${disposition}\r\n`));
    if (part.contentType) chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n`));
    chunks.push(Buffer.from("\r\n"));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(String(part.value)));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function request(jar, { method = "GET", path, json, body, headers = {} }) {
  const payload = json === undefined ? body || Buffer.alloc(0) : Buffer.from(JSON.stringify(json));
  const cookie = jar.header();
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: HOST,
      port: PORT,
      method,
      path,
      headers: {
        ...(payload.length ? { "Content-Length": payload.length } : {}),
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      jar.set(res.headers["set-cookie"]);
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, headers: res.headers, body: responseBody });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}

async function logCase(label, promise, parseJson = true) {
  const response = await promise;
  console.log(`\n=== ${label} ===`);
  console.log(`Status: ${response.statusCode}`);
  if (response.headers["content-disposition"]) console.log(`Content-Disposition: ${response.headers["content-disposition"]}`);
  console.log(parseJson ? response.body.toString("utf8") : response.body.toString("utf8"));
  return parseJson ? JSON.parse(response.body.toString("utf8")) : response;
}

async function main() {
  const jar = createCookieJar();
  const email = `file-api-${Date.now()}@example.com`;
  const password = "password123";

  await logCase("List before login", request(jar, { path: "/files" }));
  await logCase("Register", request(jar, { method: "POST", path: "/auth/register", json: { email, password } }));
  await logCase("Login", request(jar, { method: "POST", path: "/auth/login", json: { email, password } }));

  const boundary = "----module-12-boundary";
  const uploadBody = multipart(boundary, [
    { name: "displayName", value: "Node API notes" },
    { name: "tag", value: "node" },
    { name: "tag", value: "files" },
    { name: "file", filename: "notes.txt", contentType: "text/plain", value: "hello file api" },
  ]);

  const uploaded = await logCase("Upload file", request(jar, {
    method: "POST",
    path: "/files",
    body: uploadBody,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  }));
  const fileId = uploaded.files[0].id;

  await logCase("List files", request(jar, { path: "/files" }));
  await logCase("Get file", request(jar, { path: `/files/${fileId}` }));
  await logCase("Patch file", request(jar, { method: "PATCH", path: `/files/${fileId}`, json: { displayName: "Updated notes", tags: ["updated", "node"] } }));
  await logCase("Download file", request(jar, { path: `/files/${fileId}/download` }), false);
  await logCase("Delete file", request(jar, { method: "DELETE", path: `/files/${fileId}` }));
  await logCase("Get deleted file", request(jar, { path: `/files/${fileId}` }));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
