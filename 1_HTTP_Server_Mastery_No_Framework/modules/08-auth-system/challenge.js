const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3108;

function createCookieJar() {
  const cookies = new Map();

  function store(setCookieHeader) {
    if (!setCookieHeader) return;

    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

    for (const header of headers) {
      const [pair] = header.split(";");
      const separator = pair.indexOf("=");
      if (separator === -1) continue;

      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);

      if (!value) cookies.delete(key);
      else cookies.set(key, value);
    }
  }

  function header() {
    return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  return { header, store };
}

function request(jar, { method = "GET", path, body, headers = {} }) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const cookieHeader = jar.header();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        jar.store(res.headers["set-cookie"]);

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

async function runCase(jar, label, options) {
  const response = await request(jar, options);

  console.log(`\n=== ${label} ===`);
  console.log(`Status: ${response.statusCode}`);
  if (response.headers["set-cookie"]) {
    console.log(`Set-Cookie: ${response.headers["set-cookie"].join(" | ")}`);
  }
  console.log(response.body);
}

async function main() {
  const jar = createCookieJar();
  const email = `demo-${Date.now()}@example.com`;
  const password = "password123";

  await runCase(jar, "Protected files before login", {
    method: "GET",
    path: "/files",
  });

  await runCase(jar, "Register", {
    method: "POST",
    path: "/auth/register",
    body: { email, password },
  });

  await runCase(jar, "Duplicate register", {
    method: "POST",
    path: "/auth/register",
    body: { email, password },
  });

  await runCase(jar, "Wrong password", {
    method: "POST",
    path: "/auth/login",
    body: { email, password: "wrong-password" },
  });

  await runCase(jar, "Login", {
    method: "POST",
    path: "/auth/login",
    body: { email, password },
  });

  await runCase(jar, "Me with signed cookie", {
    method: "GET",
    path: "/auth/me",
  });

  await runCase(jar, "Protected files after login", {
    method: "GET",
    path: "/files",
  });

  await runCase(jar, "Logout", {
    method: "POST",
    path: "/auth/logout",
  });

  await runCase(jar, "Me after logout", {
    method: "GET",
    path: "/auth/me",
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
