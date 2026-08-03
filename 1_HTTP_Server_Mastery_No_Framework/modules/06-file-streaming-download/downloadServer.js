const fs = require("fs");
const path = require("path");

function createHttpError(statusCode, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, details);
  return err;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";

  return "application/octet-stream";
}

function safeJoin(rootDir, requestedPath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, requestedPath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw createHttpError(400, "Invalid file path");
  }

  return resolved;
}

function contentDisposition(filename) {
  const fallbackName = path.basename(filename).replace(/["\\]/g, "_");
  return `attachment; filename="${fallbackName}"`;
}

function parseRange(rangeHeader, fileSize) {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    throw createHttpError(416, "Invalid Range header", {
      contentRange: `bytes */${fileSize}`,
    });
  }

  const [, rawStart, rawEnd] = match;

  if (rawStart === "" && rawEnd === "") {
    throw createHttpError(416, "Invalid Range header", {
      contentRange: `bytes */${fileSize}`,
    });
  }

  let start;
  let end;

  if (rawStart === "") {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      throw createHttpError(416, "Invalid suffix range", {
        contentRange: `bytes */${fileSize}`,
      });
    }

    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? fileSize - 1 : Number(rawEnd);
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    throw createHttpError(416, "Range not satisfiable", {
      contentRange: `bytes */${fileSize}`,
    });
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

async function streamDownload(req, res, options) {
  const { rootDir, fileName, asAttachment = true, headOnly = false } = options;
  const filePath = safeJoin(rootDir, fileName);
  const stat = await fs.promises.stat(filePath).catch(() => null);

  if (!stat || !stat.isFile()) {
    throw createHttpError(404, "File not found");
  }

  const range = parseRange(req.headers.range, stat.size);
  const downloadName = path.basename(filePath);
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": guessContentType(filePath),
    "Content-Disposition": asAttachment ? contentDisposition(downloadName) : "inline",
  };

  if (!range) {
    res.writeHead(200, {
      ...baseHeaders,
      "Content-Length": stat.size,
    });

    if (headOnly) {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
    return;
  }

  const chunkSize = range.end - range.start + 1;

  res.writeHead(206, {
    ...baseHeaders,
    "Content-Length": chunkSize,
    "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
  });

  if (headOnly) {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath, {
    start: range.start,
    end: range.end,
  });

  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  stream.pipe(res);
}

module.exports = {
  guessContentType,
  parseRange,
  safeJoin,
  streamDownload,
};
