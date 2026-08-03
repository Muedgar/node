const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".ico") return "image/x-icon";

  return "application/octet-stream";
}

function safeJoin(rootDir, urlPath) {
  const root = path.resolve(rootDir);
  const decodedPath = decodeURIComponent(urlPath);
  const resolved = path.resolve(root, "." + decodedPath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw createHttpError(400, "Invalid static file path");
  }

  return resolved;
}

function createEtag(stat) {
  const value = `${stat.size}:${Number(stat.mtimeMs)}`;
  return `"${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}"`;
}

function cacheControlFor(filePath) {
  if (path.basename(filePath) === "index.html") {
    return "no-cache";
  }

  if (/\.(?:css|js|png|jpg|jpeg|svg|ico)$/i.test(filePath)) {
    return "public, max-age=3600";
  }

  return "public, max-age=60";
}

async function resolveStaticFile(rootDir, urlPath) {
  let filePath = safeJoin(rootDir, urlPath);
  let stat = await fs.promises.stat(filePath).catch(() => null);

  if (stat && stat.isDirectory()) {
    filePath = path.join(filePath, "index.html");
    stat = await fs.promises.stat(filePath).catch(() => null);
  }

  if (!stat || !stat.isFile()) {
    throw createHttpError(404, "Static file not found");
  }

  return { filePath, stat };
}

async function serveStatic(req, res, options) {
  const {
    rootDir,
    urlPrefix = "/static",
  } = options;

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (!url.pathname.startsWith(urlPrefix)) {
    return false;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      "Content-Type": "application/json; charset=utf-8",
      Allow: "GET, HEAD",
    });
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return true;
  }

  const relativeUrlPath = url.pathname.slice(urlPrefix.length) || "/";
  const { filePath, stat } = await resolveStaticFile(rootDir, relativeUrlPath);
  const etag = createEtag(stat);

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, {
      ETag: etag,
      "Cache-Control": cacheControlFor(filePath),
    });
    res.end();
    return true;
  }

  res.writeHead(200, {
    "Content-Type": guessContentType(filePath),
    "Content-Length": stat.size,
    "Cache-Control": cacheControlFor(filePath),
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
  });

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Static file read error");
  });
  stream.pipe(res);
  return true;
}

module.exports = {
  cacheControlFor,
  guessContentType,
  safeJoin,
  serveStatic,
};
