const http = require("http");
const path = require("path");
const { serveStatic } = require("./staticServer");

const HOST = "127.0.0.1";
const PORT = 3107;
const PUBLIC_ROOT = path.join(__dirname, "public");

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function handleRequest(req, res) {
  try {
    const handled = await serveStatic(req, res, {
      rootDir: PUBLIC_ROOT,
      urlPrefix: "/static",
    });

    if (handled) return;

    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === "/") {
      res.writeHead(302, {
        Location: "/static/",
      });
      res.end();
      return;
    }

    if (url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        module: "07-static-file-server",
      });
    }

    return sendJson(res, 404, {
      ok: false,
      error: "Route not found",
      routes: ["/", "/health", "/static/*"],
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
  console.log("07 - Static File Server");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Open http://${HOST}:${PORT}/static/`);
});
