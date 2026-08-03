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
  return crypto.createHmac("sha256", COOKIE_SECRET).update(value).digest("base64url");
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
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest).toString("hex");
  return { salt, iterations, keyLength, digest, hash };
}

function verifyPassword(password, record) {
  const hash = crypto.pbkdf2Sync(password, record.salt, record.iterations, record.keyLength, record.digest).toString("hex");
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
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail.includes("@")) throw httpError(400, "A valid email is required");
    if (typeof password !== "string" || password.length < 8) throw httpError(400, "Password must be at least 8 characters");
    if (users.some((user) => user.email === normalizedEmail)) throw httpError(409, "User already exists");

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
    const normalizedEmail = String(email || "").trim().toLowerCase();
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
    return { session, user: { id: user.id, email: user.email, createdAt: user.createdAt } };
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

function readJsonBody(req, limitBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(httpError(413, "JSON body too large"));
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
        reject(httpError(400, "Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function getBoundary(contentType) {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  return match ? match[1] || match[2] : null;
}

function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);
  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }
  parts.push(buffer.subarray(start));
  return parts;
}

function parseHeaders(buffer) {
  const headers = {};
  for (const line of buffer.toString("latin1").split("\r\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

function parseDisposition(value) {
  const result = {};
  result.type = String(value || "").split(";")[0].trim().toLowerCase();
  for (const match of String(value || "").matchAll(/;\s*([^=]+)="([^"]*)"/g)) {
    result[match[1].trim()] = match[2];
  }
  return result;
}

function addField(fields, name, value) {
  if (fields[name] === undefined) fields[name] = value;
  else if (Array.isArray(fields[name])) fields[name].push(value);
  else fields[name] = [fields[name], value];
}

async function readMultipart(req, { uploadDir, maxBodyBytes = 5_000_000, maxFileBytes = 3_000_000 }) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) throw httpError(415, "Expected multipart/form-data");

  const boundary = getBoundary(contentType);
  if (!boundary) throw httpError(400, "Missing multipart boundary");

  let total = 0;
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(httpError(413, "Multipart body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", reject);
  });

  await fs.promises.mkdir(uploadDir, { recursive: true });

  const body = Buffer.concat(chunks);
  const segments = splitBuffer(body, Buffer.from(`--${boundary}`));
  const fields = {};
  const files = [];
  const separator = Buffer.from("\r\n\r\n");

  for (let segment of segments) {
    if (segment.subarray(0, 2).equals(Buffer.from("\r\n"))) segment = segment.subarray(2);
    if (segment.subarray(0, 2).equals(Buffer.from("--"))) continue;
    if (segment.subarray(segment.length - 2).equals(Buffer.from("\r\n"))) segment = segment.subarray(0, segment.length - 2);
    if (!segment.length) continue;

    const headerEnd = segment.indexOf(separator);
    if (headerEnd === -1) continue;

    const headers = parseHeaders(segment.subarray(0, headerEnd));
    const content = segment.subarray(headerEnd + separator.length);
    const disposition = parseDisposition(headers["content-disposition"]);
    if (disposition.type !== "form-data" || !disposition.name) continue;

    if (!disposition.filename) {
      addField(fields, disposition.name, content.toString("utf8"));
      continue;
    }

    if (content.length > maxFileBytes) throw httpError(413, `File too large: ${disposition.filename}`);
    const safeName = path.basename(disposition.filename).replace(/[^\w.-]/g, "_");
    const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const storedPath = path.join(uploadDir, storedName);
    await fs.promises.writeFile(storedPath, content);

    files.push({
      field: disposition.name,
      originalName: disposition.filename,
      storedName,
      storedPath,
      size: content.length,
      contentType: headers["content-type"] || "application/octet-stream",
    });
  }

  return { fields, files };
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
