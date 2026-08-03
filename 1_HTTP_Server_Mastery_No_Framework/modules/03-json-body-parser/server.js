const http = require("http");
const { parseJsonBody } = require("./jsonBodyParser");

const HOST = "127.0.0.1";
const PORT = 3103;
const BODY_LIMIT_BYTES = 512;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function methodNotAllowed(res, allowedMethods) {
  return sendJson(
    res,
    405,
    {
      ok: false,
      error: "Method not allowed",
      allowedMethods,
    },
    {
      Allow: allowedMethods.join(", "),
    }
  );
}

async function handleEcho(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const parsed = await parseJsonBody(req, {
      limitBytes: BODY_LIMIT_BYTES,
      requireJsonContentType: true,
      allowEmpty: true,
    });

    return sendJson(res, 200, {
      ok: true,
      body: parsed.body,
      meta: {
        bytes: parsed.bytes,
        empty: parsed.empty,
        limitBytes: BODY_LIMIT_BYTES,
      },
    });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
      details: {
        receivedContentType: err.receivedContentType,
        parserMessage: err.parserMessage,
        limitBytes: err.limitBytes,
        receivedBytes: err.receivedBytes,
        bytes: err.bytes,
      },
    });
  }
}

async function handleRequired(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const parsed = await parseJsonBody(req, {
      limitBytes: BODY_LIMIT_BYTES,
      requireJsonContentType: true,
      allowEmpty: false,
    });

    return sendJson(res, 201, {
      ok: true,
      message: "Accepted non-empty JSON",
      body: parsed.body,
      bytes: parsed.bytes,
    });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
      details: {
        parserMessage: err.parserMessage,
        limitBytes: err.limitBytes,
        receivedBytes: err.receivedBytes,
      },
    });
  }
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      module: "03-json-body-parser",
      bodyLimitBytes: BODY_LIMIT_BYTES,
      routes: [
        "GET /health",
        "POST /echo-json",
        "POST /required-json",
      ],
      examples: [
        "curl -i -X POST http://127.0.0.1:3103/echo-json -H 'Content-Type: application/json' --data '{\"hello\":\"node\"}'",
        "curl -i -X POST http://127.0.0.1:3103/echo-json -H 'Content-Type: text/plain' --data 'hello'",
        "curl -i -X POST http://127.0.0.1:3103/echo-json -H 'Content-Type: application/json' --data '{bad'",
      ],
    });
  }

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      module: "03-json-body-parser",
    });
  }

  if (url.pathname === "/echo-json") {
    return handleEcho(req, res);
  }

  if (url.pathname === "/required-json") {
    return handleRequired(req, res);
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Route not found",
    routes: ["/", "/health", "/echo-json", "/required-json"],
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("03 - JSON Body Parser");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try POST http://${HOST}:${PORT}/echo-json`);
});
