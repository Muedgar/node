const http = require("http");
const crypto = require("crypto");
const { createEventBus } = require("./eventBus");

const HOST = "127.0.0.1";
const PORT = 3109;
const MAX_JSON_BYTES = 8_192;

const bus = createEventBus();
bus.wireAuditLog();

const files = new Map();

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
      if (!raw) return resolve({});

      try {
        resolve(JSON.parse(raw));
      } catch {
        const err = new Error("Invalid JSON body");
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on("error", reject);
  });
}

async function handleLogin(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();

    if (!email.includes("@")) {
      return sendJson(res, 400, { ok: false, error: "Valid email is required" });
    }

    const event = bus.emit("auth.login", {
      email,
      ip: req.socket.remoteAddress,
    });

    return sendJson(res, 200, {
      ok: true,
      message: "Login event emitted",
      event,
    });
  } catch (err) {
    bus.emit("server.error", {
      route: "/auth/login",
      message: err.message,
    });

    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

async function handleUpload(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson(req);
    const name = String(body.name || "").trim();
    const size = Number(body.size || 0);

    if (!name) return sendJson(res, 400, { ok: false, error: "File name is required" });
    if (!Number.isFinite(size) || size < 0) {
      return sendJson(res, 400, { ok: false, error: "File size must be a non-negative number" });
    }

    const file = {
      id: crypto.randomUUID(),
      name,
      size,
      createdAt: new Date().toISOString(),
    };
    files.set(file.id, file);

    const event = bus.emit("file.uploaded", {
      fileId: file.id,
      name: file.name,
      size: file.size,
    });

    return sendJson(res, 201, {
      ok: true,
      file,
      event,
    });
  } catch (err) {
    bus.emit("server.error", {
      route: "/files",
      message: err.message,
    });

    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

function handleDelete(req, res, fileId) {
  if (req.method !== "DELETE") return methodNotAllowed(res, ["DELETE"]);

  const file = files.get(fileId);
  if (!file) {
    return sendJson(res, 404, {
      ok: false,
      error: "File not found",
    });
  }

  files.delete(fileId);
  const event = bus.emit("file.deleted", {
    fileId: file.id,
    name: file.name,
  });

  return sendJson(res, 200, {
    ok: true,
    deleted: file,
    event,
  });
}

function handleExplode(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    throw new Error("Intentional module 09 demo error");
  } catch (err) {
    const event = bus.emit("server.error", {
      route: "/explode",
      message: err.message,
    });

    return sendJson(res, 500, {
      ok: false,
      error: err.message,
      event,
    });
  }
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      module: "09-eventemitter-internal-events",
      routes: [
        "GET /health",
        "POST /auth/login",
        "POST /files",
        "DELETE /files/:id",
        "POST /explode",
        "GET /audit-log",
      ],
    });
  }

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      module: "09-eventemitter-internal-events",
    });
  }

  if (url.pathname === "/auth/login") return handleLogin(req, res);
  if (url.pathname === "/files") return handleUpload(req, res);
  if (url.pathname === "/explode") return handleExplode(req, res);

  if (url.pathname === "/audit-log") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    return sendJson(res, 200, {
      ok: true,
      auditLog: bus.getAuditLog(),
    });
  }

  if (url.pathname.startsWith("/files/")) {
    const fileId = decodeURIComponent(url.pathname.slice("/files/".length));
    return handleDelete(req, res, fileId);
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Route not found",
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("09 - EventEmitter-Based Internal Events");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try GET http://${HOST}:${PORT}/audit-log`);
});
