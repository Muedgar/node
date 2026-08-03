function formatEvent(event) {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event.data)}`,
    "",
  ].join("\n") + "\n";
}

function createProgressHub() {
  const clients = new Map();
  const history = [];
  let nextId = 1;

  function connect(req, res) {
    const uploadId = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("uploadId");
    const clientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");
    res.write("retry: 3000\n\n");

    const client = { id: clientId, uploadId, res };
    clients.set(clientId, client);

    for (const event of history) {
      if (!uploadId || event.data.uploadId === uploadId) {
        res.write(formatEvent(event));
      }
    }

    req.on("close", () => {
      clients.delete(clientId);
    });
  }

  function publish(type, data) {
    const event = {
      id: String(nextId++),
      type,
      data,
    };

    history.push(event);
    if (history.length > 100) history.shift();

    for (const client of clients.values()) {
      if (!client.uploadId || client.uploadId === data.uploadId) {
        client.res.write(formatEvent(event));
      }
    }

    return event;
  }

  function stats() {
    return {
      connectedClients: clients.size,
      historySize: history.length,
    };
  }

  return { connect, publish, stats };
}

module.exports = { createProgressHub };
