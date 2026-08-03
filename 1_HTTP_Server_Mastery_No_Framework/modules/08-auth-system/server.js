const http = require("http");
const {
  COOKIE_NAME,
  clearSessionCookie,
  createAuthStore,
  parseCookies,
  sessionCookie,
  verifySignedCookie,
} = require("./authCore");

const HOST = "127.0.0.1";
const PORT = 3108;
const MAX_JSON_BYTES = 4_096;

const auth = createAuthStore();

const fileTemplates = [
  { id: "file-1", name: "private-node-notes.md" },
  { id: "file-2", name: "upload-plan.txt" },
];

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function methodNotAllowed(res, allowedMethods) {
  return sendJson(
    res,
    405,
    {
      ok: false,
      error: "Method not allowed",
      allowedMethods,
    },
    { Allow: allowedMethods.join(", ") }
  );
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      const err = new Error("Expected Content-Type: application/json");
      err.statusCode = 415;
      reject(err);
      return;
    }

    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;

      if (total > MAX_JSON_BYTES) {
        const err = new Error("JSON body too large");
        err.statusCode = 413;
        reject(err);
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();

      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        err.message = "Invalid JSON body";
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on("error", reject);
  });
}

async function handleRegister(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson(req);
    const user = auth.register(body.email, body.password);
    return sendJson(res, 201, { ok: true, user });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

async function handleLogin(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson(req);
    const { session, user } = auth.login(body.email, body.password);

    return sendJson(
      res,
      200,
      {
        ok: true,
        user,
        session: {
          id: session.id,
          createdAt: session.createdAt,
        },
      },
      { "Set-Cookie": sessionCookie(session.id) }
    );
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

function handleLogout(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const cookies = parseCookies(req.headers.cookie);
  const sessionId = verifySignedCookie(cookies[COOKIE_NAME]);
  auth.destroySession(sessionId);

  return sendJson(
    res,
    200,
    {
      ok: true,
      message: "Logged out",
    },
    { "Set-Cookie": clearSessionCookie() }
  );
}

function handleMe(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const session = auth.requireUser(req);

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: session.userId,
        email: session.email,
      },
      session: {
        id: session.id,
        createdAt: session.createdAt,
      },
    });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

function handleFiles(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const session = auth.requireUser(req);

    return sendJson(res, 200, {
      ok: true,
      files: fileTemplates.map((file) => ({
        ...file,
        ownerEmail: session.email,
      })),
    });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      module: "08-auth-system",
      routes: [
        "GET /health",
        "POST /auth/register",
        "POST /auth/login",
        "POST /auth/logout",
        "GET /auth/me",
        "GET /files",
      ],
      demoUser: {
        email: "demo@example.com",
        password: "password123",
      },
    });
  }

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      module: "08-auth-system",
    });
  }

  if (url.pathname === "/auth/register") return handleRegister(req, res);
  if (url.pathname === "/auth/login") return handleLogin(req, res);
  if (url.pathname === "/auth/logout") return handleLogout(req, res);
  if (url.pathname === "/auth/me") return handleMe(req, res);
  if (url.pathname === "/files") return handleFiles(req, res);

  return sendJson(res, 404, {
    ok: false,
    error: "Route not found",
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("08 - Auth System");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try POST http://${HOST}:${PORT}/auth/register`);
});
