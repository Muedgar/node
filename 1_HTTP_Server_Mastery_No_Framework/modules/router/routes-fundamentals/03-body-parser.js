const { parseQuery } = require("./02-query-parser");
const { httpError } = require("./10-validation");
const consumed = new WeakSet();

// Parameters such as charset must not change which parser owns the request body.
function mediaType(req) {
  return String(req.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

// Both ordinary JSON and application/problem+json carry JSON representations.
function isJsonContentType(value) {
  const type = String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return (
    type === "application/json" || /^application\/[\w.+-]+\+json$/.test(type)
  );
}

// Reject programmer mistakes at registration time, before a request arrives.
function checkBodyLimit(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new RangeError("Invalid body limit");
}

// Let Node handle stream events; our job is only to collect bytes and enforce the limit.
// destroyOnReturn:false keeps the socket open so an oversized body can receive HTTP 413.
async function readBody(req, limitBytes) {
  checkBodyLimit(limitBytes);
  if (consumed.has(req) || req.readableEnded)
    throw httpError(400, "Request body already consumed");
  if (req.aborted || req.destroyed)
    throw httpError(400, "Request body stream was aborted");
  consumed.add(req);
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length;
      if (bytes > limitBytes)
        throw Object.assign(httpError(413, "Body too large"), {
          limitBytes,
          receivedBytes: bytes,
        });
      chunks.push(chunk);
    }
  } catch (error) {
    req.resume();
    throw error.statusCode
      ? error
      : httpError(400, "Request body stream was aborted");
  }
  return Buffer.concat(chunks);
}

// Decode one bounded body and retain metadata used by the original parser lesson.
async function parseJsonBody(
  req,
  {
    limitBytes = 100_000,
    requireJsonContentType = true,
    allowEmpty = true,
  } = {}
) {
  if (
    requireJsonContentType &&
    !isJsonContentType(req.headers["content-type"])
  ) {
    throw httpError(415, "Expected Content-Type: application/json");
  }
  const buffer = await readBody(req, limitBytes);
  const raw = buffer.toString("utf8");
  const empty = !raw.trim();
  if (empty && !allowEmpty)
    throw httpError(400, "Empty JSON body is not allowed");
  let body = null;
  try {
    if (!empty) body = JSON.parse(raw);
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
  return { body, raw, bytes: buffer.length, empty };
}

// JSON middleware owns only JSON bodies; other media types must reach their parser.
function json({ limit = 100_000 } = {}) {
  checkBodyLimit(limit);
  return async (req, res, next) => {
    if (!isJsonContentType(req.headers["content-type"])) return next();
    req.body = (await parseJsonBody(req, { limitBytes: limit })).body;
    return next();
  };
}

// HTML forms use URL encoding, so reuse query decoding instead of writing it twice.
function urlencoded({ limit = 100_000 } = {}) {
  checkBodyLimit(limit);
  return async (req, res, next) => {
    if (mediaType(req) !== "application/x-www-form-urlencoded") return next();
    const buffer = await readBody(req, limit);
    req.body = parseQuery(new URLSearchParams(buffer.toString("utf8")));
    return next();
  };
}

module.exports = {
  readBody,
  mediaType,
  isJsonContentType,
  checkBodyLimit,
  parseJsonBody,
  json,
  urlencoded,
};
