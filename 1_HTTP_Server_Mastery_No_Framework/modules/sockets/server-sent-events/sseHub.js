const crypto = require("crypto");

function formatSseMessage(event) {
  const lines = [];

  if (event.id !== undefined) lines.push(`id: ${event.id}`);
  if (event.type) lines.push(`event: ${event.type}`);

  const data = JSON.stringify(event.data ?? {});
  for (const line of data.split("\n")) {
    lines.push(`data: ${line}`);
  }

  lines.push("");
  return lines.join("\n") + "\n";
}

function formatComment(comment) {
  return `: ${comment}\n\n`;
}

function createSseHub({ heartbeatMs = 15_000, replayLimit = 50 } = {}) {
  const clients = new Map();
  const history = [];
  let nextEventId = 1;

  function addToHistory(event) {
    history.push(event);
    if (history.length > replayLimit) history.shift();
  }

  function sendToClient(client, event) {
    client.res.write(formatSseMessage(event));
    client.lastSentEventId = event.id;
  }

  function replay(client, lastEventId) {
    const numericLastId = Number(lastEventId);
    if (!Number.isSafeInteger(numericLastId)) return 0;

    const missed = history.filter((event) => Number(event.id) > numericLastId);
    for (const event of missed) sendToClient(client, event);
    return missed.length;
  }

  function connect(req, res) {
    const clientId = crypto.randomUUID();

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(formatComment("connected"));
    res.write("retry: 3000\n\n");

    const client = {
      id: clientId,
      connectedAt: new Date().toISOString(),
      lastSentEventId: null,
      req,
      res,
    };

    clients.set(clientId, client);
    const replayed = replay(client, req.headers["last-event-id"]);

    const hello = {
      id: String(nextEventId++),
      type: "client.connected",
      data: {
        clientId,
        connectedClients: clients.size,
        replayed,
      },
      createdAt: new Date().toISOString(),
    };
    addToHistory(hello);
    sendToClient(client, hello);

    req.on("close", () => {
      clients.delete(clientId);
    });

    return client;
  }

  function broadcast(type, data = {}) {
    const event = {
      id: String(nextEventId++),
      type,
      data,
      createdAt: new Date().toISOString(),
    };

    addToHistory(event);

    for (const client of clients.values()) {
      sendToClient(client, event);
    }

    return event;
  }

  function heartbeat() {
    const comment = formatComment(`heartbeat ${new Date().toISOString()}`);

    for (const client of clients.values()) {
      client.res.write(comment);
    }
  }

  const heartbeatTimer = setInterval(heartbeat, heartbeatMs);
  heartbeatTimer.unref();

  function stats() {
    return {
      clients: [...clients.values()].map((client) => ({
        id: client.id,
        connectedAt: client.connectedAt,
        lastSentEventId: client.lastSentEventId,
      })),
      connectedClients: clients.size,
      historySize: history.length,
      nextEventId,
    };
  }

  function close() {
    clearInterval(heartbeatTimer);
    for (const client of clients.values()) {
      client.res.end();
    }
    clients.clear();
  }

  return {
    broadcast,
    close,
    connect,
    formatSseMessage,
    stats,
  };
}

module.exports = { createSseHub, formatSseMessage };
