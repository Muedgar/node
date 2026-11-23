const { parseQuery } = require("./02-query-parser");
const { httpError } = require("./10-validation");

// Expose one request context; a fixed base keeps URL parsing independent of Host headers.
function prepare(req) {
  let url;
  try {
    decodeURI(req.url.split("?")[0]);
    url = new URL(req.url, "http://localhost");
  } catch {
    throw httpError(400, "Invalid URL encoding or URL");
  }
  Object.assign(req, {
    path: url.pathname,
    originalUrl: req.url,
    baseUrl: "",
    params: {},
    query: parseQuery(url.searchParams),
  });
}

// Decorate the real Node objects rather than hiding the HTTP lifecycle behind wrappers.
function decorate(req, res) {
  // Header lookup is case-insensitive even when controller code uses mixed casing.
  req.get = (name) => req.headers[String(name).toLowerCase()];
  res.locals = Object.create(null);

  // Chainable status selection keeps controllers readable: res.status(201).json(record).
  res.status = (code) => {
    if (!Number.isInteger(code) || code < 100 || code > 599)
      throw new RangeError("Invalid status code");
    res.statusCode = code;
    return res;
  };

  // Convert one value to bytes once; byte length must not be confused with string length.
  res.send = (value) => {
    if (res.writableEnded || res.destroyed) return res;
    if (value !== null && typeof value === "object" && !Buffer.isBuffer(value))
      return res.json(value);
    if (res.statusCode === 204 || res.statusCode === 304) {
      for (const header of [
        "Content-Type",
        "Content-Length",
        "Transfer-Encoding",
      ])
        res.removeHeader(header);
      res.end();
      return res;
    }
    const body = Buffer.isBuffer(value)
      ? value
      : Buffer.from(String(value ?? ""));
    if (!res.hasHeader("Content-Type")) {
      res.setHeader(
        "Content-Type",
        Buffer.isBuffer(value)
          ? "application/octet-stream"
          : "text/plain; charset=utf-8"
      );
    }
    res.setHeader("Content-Length", body.length);
    res.end(body);
    return res;
  };

  // JSON responses share the same byte-writing path as text and buffers.
  res.json = (value) => {
    if (res.writableEnded || res.destroyed) return res;
    const body = JSON.stringify(value);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.send(body);
  };
}

// Downloads accept one closed, open-ended or suffix byte range; invalid ranges need 416.
function parseRange(header, fileSize) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  // Preserve the required Content-Range metadata on every invalid-range error.
  const invalid = () =>
    Object.assign(httpError(416, "Range not satisfiable"), {
      contentRange: `bytes */${fileSize}`,
    });
  if (!match || (!match[1] && !match[2])) throw invalid();
  const [, first, last] = match;
  const suffix = first === "";
  const length = Number(last);
  if (suffix && (!Number.isSafeInteger(length) || length <= 0)) throw invalid();
  const start = suffix ? Math.max(fileSize - length, 0) : Number(first);
  const end = suffix || last === "" ? fileSize - 1 : Number(last);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  )
    throw invalid();
  return { start, end: Math.min(end, fileSize - 1) };
}

module.exports = { prepare, decorate, parseRange };
