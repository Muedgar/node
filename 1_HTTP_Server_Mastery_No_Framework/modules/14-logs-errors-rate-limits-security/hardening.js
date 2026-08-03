const crypto = require("crypto");

function createHttpError(statusCode, message, options = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.expose = options.expose ?? statusCode < 500;
  err.details = options.details;
  return err;
}

function createAccessLog({ limit = 200 } = {}) {
  const entries = [];

  function write(entry) {
    entries.push(entry);
    if (entries.length > limit) entries.shift();
    console.log(JSON.stringify(entry));
  }

  function list() {
    return [...entries].reverse();
  }

  return { list, write };
}

function createRateLimiter({ windowMs = 60_000, maxRequests = 10 } = {}) {
  const buckets = new Map();

  function check(ip) {
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || now >= bucket.resetAt) {
      const next = {
        count: 1,
        resetAt: now + windowMs,
      };
      buckets.set(ip, next);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: next.resetAt,
      };
    }

    bucket.count += 1;
    return {
      allowed: bucket.count <= maxRequests,
      remaining: Math.max(maxRequests - bucket.count, 0),
      resetAt: bucket.resetAt,
    };
  }

  return { check };
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function requestId(req) {
  const existing = req.headers["x-request-id"];
  if (existing && /^[a-zA-Z0-9_.:-]{6,80}$/.test(existing)) return existing;
  return crypto.randomUUID();
}

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    ...extra,
  };
}

function sendJson(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function readJsonBody(req, { limitBytes = 4_096 } = {}) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";
    if (req.method !== "GET" && req.method !== "HEAD" && !contentType.toLowerCase().includes("application/json")) {
      reject(createHttpError(415, "Expected Content-Type: application/json"));
      return;
    }

    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(createHttpError(413, "Request body too large", { details: { limitBytes } }));
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
        reject(createHttpError(400, "Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function safeErrorPayload(err, id) {
  const statusCode = err.statusCode || 500;
  return {
    ok: false,
    error: err.expose || statusCode < 500 ? err.message : "Internal server error",
    requestId: id,
    ...(err.details && statusCode < 500 ? { details: err.details } : {}),
  };
}

module.exports = {
  clientIp,
  createAccessLog,
  createHttpError,
  createRateLimiter,
  readJsonBody,
  requestId,
  safeErrorPayload,
  securityHeaders,
  sendJson,
};
