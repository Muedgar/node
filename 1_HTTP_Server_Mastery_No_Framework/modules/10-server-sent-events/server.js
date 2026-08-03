const http = require("http");
const { createSseHub } = require("./sseHub");

const HOST = "127.0.0.1";
const PORT = 3110;
const MAX_JSON_BYTES = 8_192;

const hub = createSseHub({
  heartbeatMs: 5_000,
  replayLimit: 50,
});

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

function methodNotAllowed(res, allowedMethods) {
  return sendJson(
    res,
    405,
    { ok: false, error: "Method not allowed", allowedMethods },
    { Allow: allowedMethods.join(", ") }
  );
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Module 10 SSE Dashboard</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #111827; }
      main { max-width: 920px; margin: 40px auto; padding: 0 20px; }
      button, input { font: inherit; padding: 8px 10px; }
      form { display: flex; gap: 8px; margin: 20px 0; }
      input { flex: 1; }
      pre { background: #111827; color: #d1fae5; padding: 16px; overflow: auto; min-height: 320px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Module 10 - Server-Sent Events</h1>
      <p>Events stream from <code>/events</code>. Submit the form to broadcast a custom event.</p>
      <form id="form">
        <input id="message" value="Hello from the browser">
        <button type="submit">Broadcast</button>
      </form>
      <pre id="log"></pre>
    </main>
    <script>
      const log = document.querySelector("#log");
      const form = document.querySelector("#form");
      const message = document.querySelector("#message");
      const source = new EventSource("/events");

      function append(label, event) {
        const data = event.data ? JSON.parse(event.data) : {};
        log.textContent += "\\n[" + label + "] id=" + event.lastEventId + "\\n" + JSON.stringify(data, null, 2) + "\\n";
        log.scrollTop = log.scrollHeight;
      }

      source.addEventListener("client.connected", (event) => append("client.connected", event));
      source.addEventListener("activity", (event) => append("activity", event));
      source.addEventListener("upload.progress", (event) => append("upload.progress", event));

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await fetch("/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message.value })
        });
      });
    </script>
  </body>
</html>`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_JSON_BYTES) {
        const err = new Error("JSON body too large");
        err.statusCode = 413;
        reject(err);
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
        const err = new Error("Invalid JSON body");
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on("error", reject);
  });
}

async function handleBroadcast(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson(req);
    const event = hub.broadcast("activity", {
      message: String(body.message || "Manual broadcast"),
      source: "POST /broadcast",
    });

    return sendJson(res, 202, { ok: true, event });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, { ok: false, error: err.message });
  }
}

async function handleFakeUpload(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const uploadId = `upload-${Date.now()}`;
  const steps = [0, 25, 50, 75, 100];

  steps.forEach((percent, index) => {
    setTimeout(() => {
      hub.broadcast("upload.progress", {
        uploadId,
        percent,
        done: percent === 100,
      });
    }, index * 80);
  });

  return sendJson(res, 202, {
    ok: true,
    uploadId,
    message: "Fake upload progress events scheduled",
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/") {
    return sendHtml(res, 200, dashboardHtml());
  }

  if (url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, module: "10-server-sent-events" });
  }

  if (url.pathname === "/events") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    hub.connect(req, res);
    return;
  }

  if (url.pathname === "/broadcast") return handleBroadcast(req, res);
  if (url.pathname === "/fake-upload") return handleFakeUpload(req, res);

  if (url.pathname === "/stats") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    return sendJson(res, 200, { ok: true, ...hub.stats() });
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Route not found",
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("10 - Server-Sent Events");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Open http://${HOST}:${PORT}/`);
});

process.on("SIGTERM", () => {
  hub.close();
  server.close();
});
