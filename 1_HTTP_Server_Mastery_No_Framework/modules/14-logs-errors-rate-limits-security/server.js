const http = require("http");
const {
  clientIp,
  createAccessLog,
  createHttpError,
  createRateLimiter,
  readJsonBody,
  requestId,
  safeErrorPayload,
  sendJson,
} = require("./hardening");

const HOST = "127.0.0.1";
const PORT = 3114;

const accessLog = createAccessLog();
const rateLimiter = createRateLimiter({
  windowMs: 10_000,
  maxRequests: 5,
});

function methodNotAllowed(res, allowedMethods, id) {
  return sendJson(
    res,
    405,
    {
      ok: false,
      error: "Method not allowed",
      requestId: id,
      allowedMethods,
    },
    { Allow: allowedMethods.join(", ") }
  );
}

async function route(req, res, context) {
  const { id, url } = context;

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      module: "14-logs-errors-rate-limits-security",
      requestId: id,
      routes: [
        "GET /health",
        "POST /echo",
        "GET /boom",
        "GET /logs",
      ],
      protections: [
        "request IDs",
        "security headers",
        "structured access logs",
        "safe errors",
        "JSON body limit",
        "IP rate limit",
      ],
    });
  }

  if (url.pathname === "/health") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"], id);
    return sendJson(res, 200, { ok: true, module: "14-logs-errors-rate-limits-security", requestId: id });
  }

  if (url.pathname === "/echo") {
    if (req.method !== "POST") return methodNotAllowed(res, ["POST"], id);
    const body = await readJsonBody(req, { limitBytes: 512 });
    return sendJson(res, 200, { ok: true, requestId: id, body });
  }

  if (url.pathname === "/boom") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"], id);
    throw new Error("Sensitive stack trace should not leak");
  }

  if (url.pathname === "/logs") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"], id);
    return sendJson(res, 200, { ok: true, requestId: id, logs: accessLog.list() });
  }

  throw createHttpError(404, "Route not found");
}

async function handleRequest(req, res) {
  const startedAt = Date.now();
  const id = requestId(req);
  const ip = clientIp(req);
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const limit = rateLimiter.check(ip);

  res.setHeader("X-Request-ID", id);
  res.setHeader("RateLimit-Remaining", String(limit.remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil(limit.resetAt / 1000)));

  let statusCode = 200;

  try {
    if (!limit.allowed) {
      throw createHttpError(429, "Too many requests", {
        details: {
          retryAfterSeconds: Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      });
    }

    await route(req, res, { id, ip, url });
    statusCode = res.statusCode;
  } catch (err) {
    statusCode = err.statusCode || 500;
    const retryAfter = statusCode === 429 && err.details?.retryAfterSeconds
      ? { "Retry-After": String(err.details.retryAfterSeconds) }
      : {};
    sendJson(res, statusCode, safeErrorPayload(err, id), retryAfter);
  } finally {
    accessLog.write({
      requestId: id,
      method: req.method,
      path: url.pathname,
      statusCode,
      ip,
      durationMs: Date.now() - startedAt,
      userAgent: req.headers["user-agent"] || null,
      at: new Date().toISOString(),
    });
  }
}

const server = http.createServer(handleRequest);

server.on("clientError", (err, socket) => {
  if (!socket.writable) return;
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.listen(PORT, HOST, () => {
  console.log("14 - Logs, Errors, Rate Limits, Security");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try GET http://${HOST}:${PORT}/logs`);
});
