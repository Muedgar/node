// app/static.js
const fs = require("fs");
const path = require("path");

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function safeJoin(rootDir, userPath) {
  // prevent ../../ escaping
  const resolved = path.resolve(rootDir, "." + userPath);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    const err = new Error("Invalid path");
    err.statusCode = 400;
    throw err;
  }
  return resolved;
}

function staticFiles({ rootDir, urlPrefix = "/public" }) {
  return (req, res, next) => {
    if (!req.path.startsWith(urlPrefix)) return next();

    const rel = req.path.slice(urlPrefix.length) || "/";
    const filePath = safeJoin(rootDir, rel === "/" ? "/index.html" : rel);

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) return next();

      res.statusCode = 200;
      res.setHeader("Content-Type", guessContentType(filePath));
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on("error", () => {
        if (!res.writableEnded) {
          res.statusCode = 500;
          res.end("File read error");
        }
      });
    });
  };
}

function sendDownload(res, filePath, downloadName) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "File not found" }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Length", String(st.size));

    fs.createReadStream(filePath).pipe(res);
  });
}

module.exports = { staticFiles, sendDownload };