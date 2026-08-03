const net = require("net");
const crypto = require("crypto");
const {
  createAcceptKey,
  decodeFrames,
  encodeClose,
} = require("./websocketCore");

const HOST = "127.0.0.1";
const PORT = 3111;

function encodeClientText(text) {
  const payload = Buffer.from(text);
  const mask = crypto.randomBytes(4);
  let header;

  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | payload.length;
  } else {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  }

  header[0] = 0x81;

  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) {
    masked[i] ^= mask[i % 4];
  }

  return Buffer.concat([header, mask, masked]);
}

function connectClient(name) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    const key = crypto.randomBytes(16).toString("base64");
    let handshakeBuffer = "";
    let frameBuffer = Buffer.alloc(0);
    let handshaken = false;
    const messages = [];

    socket.on("connect", () => {
      socket.write(
        [
          "GET /ws HTTP/1.1",
          `Host: ${HOST}:${PORT}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n")
      );
    });

    socket.on("data", (chunk) => {
      if (!handshaken) {
        handshakeBuffer += chunk.toString("latin1");
        const end = handshakeBuffer.indexOf("\r\n\r\n");
        if (end === -1) return;

        const headerText = handshakeBuffer.slice(0, end);
        const leftover = Buffer.from(handshakeBuffer.slice(end + 4), "latin1");
        const accept = headerText.match(/Sec-WebSocket-Accept: (.+)/i)?.[1]?.trim();
        if (!headerText.startsWith("HTTP/1.1 101") || accept !== createAcceptKey(key)) {
          reject(new Error(`${name} handshake failed`));
          socket.destroy();
          return;
        }

        handshaken = true;
        if (leftover.length > 0) socket.emit("data", leftover);
        resolve(client);
        return;
      }

      frameBuffer = Buffer.concat([frameBuffer, chunk]);
      const decoded = decodeFrames(frameBuffer);
      frameBuffer = decoded.remaining;

      for (const frame of decoded.frames) {
        if (frame.opcode === 0x1) {
          const text = frame.payload.toString("utf8");
          messages.push(JSON.parse(text));
          console.log(`${name} <= ${text}`);
        }
      }
    });

    socket.on("error", reject);

    const client = {
      name,
      messages,
      send(text) {
        socket.write(encodeClientText(text));
      },
      close() {
        socket.write(encodeClose());
        socket.end();
      },
    };
  });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const alice = await connectClient("alice");
  const bob = await connectClient("bob");

  await wait(100);

  alice.send(JSON.stringify({ type: "chat.message", text: "hello from alice" }));
  bob.send(JSON.stringify({ type: "chat.message", text: "hello from bob" }));

  await wait(300);

  console.log("\nSummary");
  console.log(JSON.stringify({
    aliceMessages: alice.messages.map((message) => message.type),
    bobMessages: bob.messages.map((message) => message.type),
  }, null, 2));

  alice.close();
  bob.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
