const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  createStore,
  readJsonBody,
  readMultipart,
  sendJson,
  sessionCookie,
  streamFile,
} = require("./apiCore");

const HOST = "127.0.0.1";
const PORT = 3112;
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");

const store = createStore({
  usersPath: path.join(DATA_DIR, "users.json"),
  filesPath: path.join(DATA_DIR, "files.json"),
});

function methodNotAllowed(res, allowedMethods) {
  return sendJson(res, 405, { ok: false, error: "Method not allowed", allowedMethods }, { Allow: allowedMethods.join(", ") });
}

function matchFilePath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "files" || !parts[1]) return null;
  return { id: decodeURIComponent(parts[1]), tail: parts.slice(2) };
}

async function handleRegister(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const body = await readJsonBody(req);
  const user = await store.register(body.email, body.password);
  return sendJson(res, 201, { ok: true, user });
}

async function handleLogin(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const body = await readJsonBody(req);
  const { session, user } = await store.login(body.email, body.password);
  return sendJson(res, 200, { ok: true, user, session: { id: session.id, createdAt: session.createdAt } }, {
    "Set-Cookie": sessionCookie(session.id),
  });
}

async function handleCreateFile(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const session = store.requireSession(req);
  const { fields, files } = await readMultipart(req, { uploadDir: UPLOAD_DIR });
  if (files.length === 0) return sendJson(res, 400, { ok: false, error: "At least one file is required" });

  const existing = await store.readFiles();
  const now = new Date().toISOString();
  const created = files.map((file) => ({
    id: cryptoId(),
    ownerId: session.userId,
    ownerEmail: session.email,
    originalName: file.originalName,
    displayName: fields.displayName || fields.title || file.originalName,
    tags: normalizeTags(fields.tag),
    size: file.size,
    contentType: file.contentType,
    storedName: file.storedName,
    storedPath: file.storedPath,
    createdAt: now,
    updatedAt: now,
  }));

  await store.writeFiles([...existing, ...created]);
  return sendJson(res, 201, { ok: true, fields, files: created.map(publicFile) });
}

async function handleListFiles(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const session = store.requireSession(req);
  const all = await store.readFiles();
  const owned = all.filter((file) => file.ownerId === session.userId).map(publicFile);
  return sendJson(res, 200, { ok: true, files: owned });
}

async function handleOneFile(req, res, id, tail) {
  const session = store.requireSession(req);
  const all = await store.readFiles();
  const file = all.find((item) => item.id === id && item.ownerId === session.userId);
  if (!file) return sendJson(res, 404, { ok: false, error: "File not found" });

  if (tail.length === 1 && tail[0] === "download") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    await streamFile(res, file.storedPath, file);
    return;
  }

  if (tail.length !== 0) return sendJson(res, 404, { ok: false, error: "Route not found" });

  if (req.method === "GET") return sendJson(res, 200, { ok: true, file: publicFile(file) });

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    if (body.displayName !== undefined) file.displayName = String(body.displayName).trim() || file.displayName;
    if (body.tags !== undefined) file.tags = normalizeTags(body.tags);
    file.updatedAt = new Date().toISOString();
    await store.writeFiles(all);
    return sendJson(res, 200, { ok: true, file: publicFile(file) });
  }

  if (req.method === "DELETE") {
    await fs.promises.unlink(file.storedPath).catch(() => {});
    await store.writeFiles(all.filter((item) => item.id !== file.id));
    return sendJson(res, 200, { ok: true, deleted: publicFile(file) });
  }

  return methodNotAllowed(res, ["GET", "PATCH", "DELETE"]);
}

function cryptoId() {
  return require("crypto").randomUUID();
}

function normalizeTags(value) {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
}

function publicFile(file) {
  return {
    id: file.id,
    ownerEmail: file.ownerEmail,
    originalName: file.originalName,
    displayName: file.displayName,
    tags: file.tags,
    size: file.size,
    contentType: file.contentType,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    downloadUrl: `/files/${encodeURIComponent(file.id)}/download`,
  };
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  try {
    if (url.pathname === "/") {
      return sendJson(res, 200, {
        module: "12-file-management-api",
        routes: [
          "POST /auth/register",
          "POST /auth/login",
          "POST /files",
          "GET /files",
          "GET /files/:id",
          "GET /files/:id/download",
          "PATCH /files/:id",
          "DELETE /files/:id",
        ],
      });
    }

    if (url.pathname === "/health") return sendJson(res, 200, { ok: true, module: "12-file-management-api" });
    if (url.pathname === "/auth/register") return await handleRegister(req, res);
    if (url.pathname === "/auth/login") return await handleLogin(req, res);
    if (url.pathname === "/files") {
      if (req.method === "POST") return await handleCreateFile(req, res);
      return await handleListFiles(req, res);
    }

    const fileMatch = matchFilePath(url.pathname);
    if (fileMatch) return await handleOneFile(req, res, fileMatch.id, fileMatch.tail);

    return sendJson(res, 404, { ok: false, error: "Route not found" });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, { ok: false, error: err.message });
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("12 - Full File Management API");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try POST http://${HOST}:${PORT}/auth/register`);
});
