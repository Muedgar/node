const http = require("http");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function createModuleInfoServer(moduleInfo) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, module: moduleInfo.slug });
    }

    if (url.pathname === "/") {
      return sendJson(res, 200, moduleInfo);
    }

    return sendJson(res, 404, {
      error: "Not found",
      availableRoutes: ["/", "/health"],
    });
  });
}

function listen(moduleInfo) {
  const server = createModuleInfoServer(moduleInfo);
  const host = moduleInfo.host || "127.0.0.1";

  server.listen(moduleInfo.port, host, () => {
    console.log(`${moduleInfo.title}`);
    console.log(`Listening on http://${host}:${moduleInfo.port}`);
    console.log(`Open http://${host}:${moduleInfo.port}/`);
  });

  return server;
}

module.exports = { createModuleInfoServer, listen };
