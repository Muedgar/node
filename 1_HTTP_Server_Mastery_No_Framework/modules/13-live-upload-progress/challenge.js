const http = require("http");

const HOST = "127.0.0.1";
const PORT = 3113;

function parseFrame(frame) {
  if (!frame || frame.startsWith(":")) return null;
  const event = {};
  const data = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("id:")) event.id = line.slice(3).trim();
    else if (line.startsWith("event:")) event.type = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length) event.data = JSON.parse(data.join("\n"));
  if (!event.type && !event.data) return null;
  return event;
}

function listenProgress(uploadId) {
  return new Promise((resolve, reject) => {
    const events = [];
    let buffer = "";
    const req = http.request({
      host: HOST,
      port: PORT,
      method: "GET",
      path: `/events?uploadId=${encodeURIComponent(uploadId)}`,
      headers: { Accept: "text/event-stream" },
    }, (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        const frames = buffer.split("\n\n");
        buffer = frames.pop();
        for (const frame of frames) {
          const event = parseFrame(frame);
          if (!event) continue;
          events.push(event);
          console.log(`SSE ${event.type} ${event.data.percent}% ${event.data.receivedBytes}/${event.data.totalBytes}`);
          if (event.data.done) {
            req.destroy();
            resolve(events);
            return;
          }
        }
      });
    });
    req.on("error", (err) => {
      if (events.some((event) => event.data?.done)) return;
      reject(err);
    });
    req.end();
  });
}

function upload(uploadId, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: HOST,
      port: PORT,
      method: "POST",
      path: `/upload?uploadId=${encodeURIComponent(uploadId)}&filename=challenge.bin`,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": body.length,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);

    const chunkSize = 512;
    let offset = 0;
    function writeNext() {
      if (offset >= body.length) {
        req.end();
        return;
      }
      const end = Math.min(offset + chunkSize, body.length);
      req.write(body.subarray(offset, end));
      offset = end;
      setTimeout(writeNext, 20);
    }
    writeNext();
  });
}

async function main() {
  const uploadId = `challenge-${Date.now()}`;
  const body = Buffer.alloc(4096, "a");
  const progressPromise = listenProgress(uploadId);

  await new Promise((resolve) => setTimeout(resolve, 100));
  const response = await upload(uploadId, body);
  const events = await progressPromise;

  console.log("\nUpload response");
  console.log(`Status: ${response.statusCode}`);
  console.log(response.body);

  console.log("\nProgress summary");
  console.log(JSON.stringify({
    events: events.length,
    first: events[0].data,
    last: events[events.length - 1].data,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
