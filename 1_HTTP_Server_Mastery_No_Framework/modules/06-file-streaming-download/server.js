const http = require("http");
const fs = require("fs");
const path = require("path");
const { streamDownload } = require("./downloadServer");

const HOST = "127.0.0.1";
const PORT = 3106;
const DOWNLOAD_ROOT = path.join(__dirname, "downloads");

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

async function listFiles() {
  const entries = await fs.promises.readdir(DOWNLOAD_ROOT, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filePath = path.join(DOWNLOAD_ROOT, entry.name);
    const stat = await fs.promises.stat(filePath);
    files.push({
      name: entry.name,
      size: stat.size,
      downloadUrl: `/download/${encodeURIComponent(entry.name)}`,
    });
  }

  return files;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  try {
    if (url.pathname === "/") {
      return sendJson(res, 200, {
        module: "06-file-streaming-download",
        routes: ["GET /health", "GET /files", "GET /download/:file"],
        rangeExamples: [
          "Range: bytes=0-31",
          "Range: bytes=32-",
          "Range: bytes=-24",
        ],
      });
    }

    if (url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        module: "06-file-streaming-download",
      });
    }

    if (url.pathname === "/files") {
      return sendJson(res, 200, {
        ok: true,
        root: DOWNLOAD_ROOT,
        files: await listFiles(),
      });
    }

    if (url.pathname.startsWith("/download/")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return sendJson(
          res,
          405,
          {
            ok: false,
            error: "Method not allowed",
            allowedMethods: ["GET", "HEAD"],
          },
          { Allow: "GET, HEAD" }
        );
      }

      const fileName = decodeURIComponent(url.pathname.slice("/download/".length));
      if (req.method === "HEAD") {
        req.headers.range = undefined;
      }
      await streamDownload(req, res, {
        rootDir: DOWNLOAD_ROOT,
        fileName,
        asAttachment: true,
        headOnly: req.method === "HEAD",
      });
      return;
    }

    return sendJson(res, 404, {
      ok: false,
      error: "Route not found",
      routes: ["/", "/health", "/files", "/download/:file"],
    });
  } catch (err) {
    return sendJson(
      res,
      err.statusCode || 500,
      {
        ok: false,
        error: err.message,
      },
      err.contentRange ? { "Content-Range": err.contentRange } : {}
    );
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("06 - File Streaming Download");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try http://${HOST}:${PORT}/download/node-streaming-guide.txt`);
});
