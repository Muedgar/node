const http = require("http");
const {
  createAcceptKey,
  createWebSocketHub,
  decodeFrames,
  encodeClose,
  encodeFrame,
  isWebSocketUpgrade,
} = require("./websocketCore");

const HOST = "127.0.0.1";
const PORT = 3111;

const hub = createWebSocketHub();

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
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

function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Module 11 WebSocket Basics</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #111827; }
      main { max-width: 880px; margin: 40px auto; padding: 0 20px; }
      form { display: flex; gap: 8px; margin: 20px 0; }
      input, button { font: inherit; padding: 8px 10px; }
      input { flex: 1; }
      pre { background: #111827; color: #d1fae5; padding: 16px; min-height: 320px; overflow: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>Module 11 - WebSocket Basics</h1>
      <form id="form">
        <input id="message" value="Hello raw WebSocket">
        <button type="submit">Send</button>
      </form>
      <pre id="log"></pre>
    </main>
    <script>
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(protocol + "//" + location.host + "/ws");
      const log = document.querySelector("#log");
      const form = document.querySelector("#form");
      const message = document.querySelector("#message");

      function append(text) {
        log.textContent += text + "\\n";
        log.scrollTop = log.scrollHeight;
      }

      socket.addEventListener("open", () => append("connected"));
      socket.addEventListener("message", (event) => append(event.data));
      socket.addEventListener("close", () => append("closed"));

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        socket.send(JSON.stringify({ type: "chat.message", text: message.value }));
      });
    </script>
  </body>
</html>`;
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/") {
    return sendHtml(res, 200, dashboardHtml());
  }

  if (url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, module: "11-websocket-basics" });
  }

  if (url.pathname === "/stats") {
    return sendJson(res, 200, { ok: true, ...hub.stats() });
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Route not found",
    routes: ["/", "/health", "/stats", "WS /ws"],
  });
}

function handleUpgrade(req, socket) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname !== "/ws" || !isWebSocketUpgrade(req)) {
    socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const acceptKey = createAcceptKey(req.headers["sec-websocket-key"]);

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n")
  );

  const client = hub.add(socket);

  socket.on("data", (chunk) => {
    try {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      const decoded = decodeFrames(client.buffer);
      client.buffer = decoded.remaining;

      for (const frame of decoded.frames) {
        if (frame.opcode === 0x1) {
          const text = frame.payload.toString("utf8");
          hub.send(client, "echo", { text });
          hub.broadcast("chat.message", { from: client.id, text }, client.id);
        } else if (frame.opcode === 0x8) {
          socket.write(encodeClose());
          socket.end();
        } else if (frame.opcode === 0x9) {
          socket.write(encodeFrame(0xA, frame.payload));
        }
      }
    } catch (err) {
      socket.write(encodeClose(1002, err.message));
      socket.end();
    }
  });
}

const server = http.createServer(handleRequest);

server.on("upgrade", handleUpgrade);

server.listen(PORT, HOST, () => {
  console.log("11 - WebSocket Basics");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Open http://${HOST}:${PORT}/`);
});
