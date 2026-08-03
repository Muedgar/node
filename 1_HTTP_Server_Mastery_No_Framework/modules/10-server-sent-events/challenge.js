const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3110;

function postJson(path, body = {}) {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method: "POST",
        path,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", reject);
    req.end(payload);
  });
}

function openSse({ lastEventId, eventLimit = 4 }) {
  return new Promise((resolve, reject) => {
    const events = [];
    let buffer = "";

    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method: "GET",
        path: "/events",
        headers: {
          Accept: "text/event-stream",
          ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
        },
      },
      (res) => {
        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          buffer += chunk;
          const frames = buffer.split("\n\n");
          buffer = frames.pop();

          for (const frame of frames) {
            const event = parseFrame(frame);
            if (!event) continue;
            events.push(event);
            console.log(`SSE ${event.event || "message"} id=${event.id || ""} data=${event.data}`);

            if (events.length >= eventLimit) {
              req.destroy();
              resolve(events);
              return;
            }
          }
        });
      }
    );

    req.on("error", (err) => {
      if (events.length >= eventLimit) return;
      reject(err);
    });

    req.end();
  });
}

function parseFrame(frame) {
  if (!frame || frame.startsWith(":")) return null;

  const event = {};
  const data = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("id:")) event.id = line.slice(3).trim();
    else if (line.startsWith("event:")) event.event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }

  if (data.length > 0) event.data = data.join("\n");
  if (!event.id && !event.event && !event.data) return null;
  return event;
}

async function main() {
  const firstStream = openSse({ eventLimit: 4 });

  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log("\nPOST /broadcast");
  console.log((await postJson("/broadcast", { message: "challenge broadcast" })).body);

  console.log("\nPOST /fake-upload");
  console.log((await postJson("/fake-upload")).body);

  const firstEvents = await firstStream;
  const lastId = firstEvents[firstEvents.length - 1].id;

  console.log(`\nReconnecting with Last-Event-ID: ${lastId}`);
  await postJson("/broadcast", { message: "event created before reconnect" });
  const replayedEvents = await openSse({ lastEventId: lastId, eventLimit: 2 });

  console.log("\nReplay check");
  console.log(JSON.stringify(replayedEvents, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
