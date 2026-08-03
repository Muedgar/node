const http = require("http");
const path = require("path");
const { createProgressHub } = require("./progressHub");
const { streamUploadWithProgress } = require("./uploadProgress");

const HOST = "127.0.0.1";
const PORT = 3113;
const UPLOAD_DIR = path.join(__dirname, "uploads");

const hub = createProgressHub();

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function sendHtml(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function page() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Module 13 Live Upload Progress</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #111827; }
      main { max-width: 860px; margin: 40px auto; padding: 0 20px; }
      progress { width: 100%; height: 24px; }
      pre { background: #111827; color: #d1fae5; padding: 16px; min-height: 260px; overflow: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>Module 13 - Live Upload Progress</h1>
      <input id="file" type="file">
      <button id="upload">Upload</button>
      <progress id="bar" max="100" value="0"></progress>
      <pre id="log"></pre>
    </main>
    <script>
      const fileInput = document.querySelector("#file");
      const button = document.querySelector("#upload");
      const bar = document.querySelector("#bar");
      const log = document.querySelector("#log");

      button.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const uploadId = crypto.randomUUID();
        const source = new EventSource("/events?uploadId=" + encodeURIComponent(uploadId));
        source.addEventListener("upload.progress", (event) => {
          const data = JSON.parse(event.data);
          if (data.percent !== null) bar.value = data.percent;
          log.textContent += JSON.stringify(data, null, 2) + "\\n";
          if (data.done) source.close();
        });

        await fetch("/upload?uploadId=" + encodeURIComponent(uploadId) + "&filename=" + encodeURIComponent(file.name), {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file
        });
      });
    </script>
  </body>
</html>`;
}

async function handleUpload(req, res, url) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed", allowedMethods: ["POST"] }, { Allow: "POST" });
  }

  const uploadId = url.searchParams.get("uploadId") || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fileName = url.searchParams.get("filename") || req.headers["x-filename"] || "upload.bin";

  try {
    const result = await streamUploadWithProgress(req, {
      uploadDir: UPLOAD_DIR,
      uploadId,
      fileName,
      publish: hub.publish,
    });

    return sendJson(res, 201, { ok: true, file: result });
  } catch (err) {
    hub.publish("upload.error", {
      uploadId,
      message: err.message,
    });
    return sendJson(res, err.statusCode || 500, { ok: false, error: err.message });
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/") return sendHtml(res, 200, page());
  if (url.pathname === "/health") return sendJson(res, 200, { ok: true, module: "13-live-upload-progress" });
  if (url.pathname === "/events") {
    if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET" });
    hub.connect(req, res);
    return;
  }
  if (url.pathname === "/upload") return handleUpload(req, res, url);
  if (url.pathname === "/stats") return sendJson(res, 200, { ok: true, ...hub.stats() });

  return sendJson(res, 404, { ok: false, error: "Route not found" });
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("13 - Live Upload/Progress Notifications");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Open http://${HOST}:${PORT}/`);
});
