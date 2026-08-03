const http = require("http");
const { createRouter } = require("./router");

const HOST = "127.0.0.1";
const PORT = 3102;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function parseQuery(searchParams) {
  const query = {};

  for (const [key, value] of searchParams.entries()) {
    if (query[key] === undefined) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }

  return query;
}

function createRequestContext(req) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  return {
    method: req.method,
    url: req.url,
    pathname: url.pathname,
    query: parseQuery(url.searchParams),
    params: {},
  };
}

const router = createRouter();

router.get("/", (req, res) => {
  sendJson(res, 200, {
    module: "02-routing-system-from-scratch",
    routes: router.listRoutes(),
    examples: [
      "GET /users/42",
      "GET /users/42/files/report.pdf",
      "GET /users/42/files/report.pdf?download=true&tag=node&tag=http",
      "POST /users/42/files",
      "DELETE /users/42/files/report.pdf",
    ],
  });
});

router.get("/health", (req, res) => {
  sendJson(res, 200, {
    ok: true,
    module: "02-routing-system-from-scratch",
  });
});

router.get("/users/:userId", (req, res) => {
  sendJson(res, 200, {
    action: "show-user",
    params: req.params,
    query: req.query,
  });
});

router.get("/users/:userId/files/:fileId", (req, res) => {
  sendJson(res, 200, {
    action: "show-user-file",
    matchedRoute: req.route,
    params: req.params,
    query: req.query,
  });
});

router.post("/users/:userId/files", (req, res) => {
  sendJson(res, 201, {
    action: "create-user-file",
    params: req.params,
    note: "Module 03 will parse request bodies. This module focuses only on routing.",
  });
});

router.delete("/users/:userId/files/:fileId", (req, res) => {
  sendJson(res, 200, {
    action: "delete-user-file",
    params: req.params,
  });
});

function handleRequest(req, res) {
  const requestContext = createRequestContext(req);

  try {
    const matched = router.match(req.method, requestContext.pathname);

    if (matched.type === "match") {
      req.params = matched.params;
      req.query = requestContext.query;
      req.path = requestContext.pathname;
      req.route = matched.route;
      return matched.handler(req, res);
    }

    if (matched.type === "method-not-allowed") {
      return sendJson(
        res,
        405,
        {
          ok: false,
          error: "Method not allowed",
          method: req.method,
          path: requestContext.pathname,
          allowedMethods: matched.allowedMethods,
        },
        {
          Allow: matched.allowedMethods.join(", "),
        }
      );
    }

    return sendJson(res, 404, {
      ok: false,
      error: "Route not found",
      method: req.method,
      path: requestContext.pathname,
    });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("02 - Routing System From Scratch");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try http://${HOST}:${PORT}/users/42/files/report.pdf?tag=node&tag=http`);
});
