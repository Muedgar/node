const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const COOKIE_NAME = "fm_sid";
const COOKIE_SECRET = "module-12-file-api-learning-secret";

function httpError(statusCode, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, details);
  return err;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function sign(value) {
  return crypto
    .createHmac("sha256", COOKIE_SECRET)
    .update(value)
    .digest("base64url");
}

function signedCookieValue(value) {
  return `${value}.${sign(value)}`;
}

function verifySignedCookie(value) {
  if (!value || !value.includes(".")) return null;

  const index = value.lastIndexOf(".");
  const raw = value.slice(0, index);
  const signature = value.slice(index + 1);
  const expected = sign(raw);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) return null;
  return crypto.timingSafeEqual(left, right) ? raw : null;
}

function sessionCookie(sessionId) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(signedCookieValue(sessionId))}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=3600",
  ].join("; ");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 100_000;
  const keyLength = 32;
  const digest = "sha256";
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, keyLength, digest)
    .toString("hex");
  return { salt, iterations, keyLength, digest, hash };
}

function verifyPassword(password, record) {
  const hash = crypto
    .pbkdf2Sync(
      password,
      record.salt,
      record.iterations,
      record.keyLength,
      record.digest
    )
    .toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(record.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function ensureJsonFile(filePath, fallback) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.promises.access(filePath);
  } catch {
    await fs.promises.writeFile(filePath, JSON.stringify(fallback, null, 2));
  }
}

async function readJsonFile(filePath, fallback) {
  await ensureJsonFile(filePath, fallback);
  return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
}

async function writeJsonFile(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2));
}

function createStore({ usersPath, filesPath }) {
  const sessions = new Map();

  async function register(email, password) {
    const users = await readJsonFile(usersPath, []);
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail.includes("@"))
      throw httpError(400, "A valid email is required");
    if (typeof password !== "string" || password.length < 8)
      throw httpError(400, "Password must be at least 8 characters");
    if (users.some((user) => user.email === normalizedEmail))
      throw httpError(409, "User already exists");

    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await writeJsonFile(usersPath, users);
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  async function login(email, password) {
    const users = await readJsonFile(usersPath, []);
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const user = users.find((item) => item.email === normalizedEmail);

    if (!user || !verifyPassword(String(password || ""), user.password)) {
      throw httpError(401, "Invalid email or password");
    }

    const session = {
      id: crypto.randomUUID(),
      userId: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    };

    sessions.set(session.id, session);
    return {
      session,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    };
  }

  function requireSession(req) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = verifySignedCookie(cookies[COOKIE_NAME]);
    const session = sessionId ? sessions.get(sessionId) : null;
    if (!session) throw httpError(401, "Authentication required");
    return session;
  }

  async function readFiles() {
    return readJsonFile(filesPath, []);
  }

  async function writeFiles(files) {
    await writeJsonFile(filesPath, files);
  }

  return { login, readFiles, register, requireSession, writeFiles };
}

async function readJsonBody(req, limitBytes = 1_000_000) {
  const {
    parseJsonBody,
  } = require("../../router/routes-fundamentals/03-body-parser");
  return (
    (await parseJsonBody(req, { limitBytes, requireJsonContentType: false }))
      .body ?? {}
  );
}

async function readMultipart(req, options) {
  const {
    parseMultipartForm,
  } = require("../../router/routes-fundamentals/04-upload-parser");
  const parsed = await parseMultipartForm(req, {
    maxBodyBytes: 5_000_000,
    maxFileBytes: 3_000_000,
    ...options,
  });
  return {
    fields: parsed.fields,
    files: parsed.files.map((file) => ({
      ...file,
      storedName: file.savedAs,
      storedPath: path.join(options.uploadDir, file.savedAs),
    })),
  };
}

function streamFile(res, filePath, metadata) {
  return fs.promises.stat(filePath).then((stat) => {
    res.writeHead(200, {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="${metadata.originalName.replace(/["\\]/g, "_")}"`,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

module.exports = {
  createStore,
  httpError,
  readJsonBody,
  readMultipart,
  sendJson,
  sessionCookie,
  streamFile,
};
