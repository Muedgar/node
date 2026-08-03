const crypto = require("crypto");

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function createAcceptKey(secWebSocketKey) {
  return crypto
    .createHash("sha1")
    .update(secWebSocketKey + WS_GUID)
    .digest("base64");
}

function encodeFrame(opcode, payload = Buffer.alloc(0)) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const length = data.length;
  let header;

  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length <= 0xffff) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  header[0] = 0x80 | opcode;
  return Buffer.concat([header, data]);
}

function encodeText(text) {
  return encodeFrame(0x1, Buffer.from(text));
}

function encodeJson(type, data) {
  return encodeText(JSON.stringify({ type, data, at: new Date().toISOString() }));
}

function encodeClose(code = 1000, reason = "") {
  const reasonBuffer = Buffer.from(reason);
  const payload = Buffer.alloc(2 + reasonBuffer.length);
  payload.writeUInt16BE(code, 0);
  reasonBuffer.copy(payload, 2);
  return encodeFrame(0x8, payload);
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const fin = (firstByte & 0x80) === 0x80;
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let cursor = offset + 2;

    if (payloadLength === 126) {
      if (cursor + 2 > buffer.length) break;
      payloadLength = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (payloadLength === 127) {
      if (cursor + 8 > buffer.length) break;
      const bigLength = buffer.readBigUInt64BE(cursor);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Frame too large");
      }
      payloadLength = Number(bigLength);
      cursor += 8;
    }

    let mask;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (cursor + payloadLength > buffer.length) break;

    const payload = Buffer.from(buffer.subarray(cursor, cursor + payloadLength));
    if (masked) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
    }

    frames.push({ fin, opcode, masked, payload });
    offset = cursor + payloadLength;
  }

  return {
    frames,
    remaining: buffer.subarray(offset),
  };
}

function createWebSocketHub() {
  const clients = new Map();

  function add(socket) {
    const client = {
      id: crypto.randomUUID(),
      socket,
      connectedAt: new Date().toISOString(),
      buffer: Buffer.alloc(0),
    };

    clients.set(client.id, client);

    socket.on("close", () => {
      clients.delete(client.id);
      broadcast("client.left", { clientId: client.id }, client.id);
    });

    socket.on("error", () => {
      clients.delete(client.id);
    });

    send(client, "welcome", {
      clientId: client.id,
      connectedClients: clients.size,
    });
    broadcast("client.joined", { clientId: client.id, connectedClients: clients.size }, client.id);

    return client;
  }

  function send(client, type, data) {
    if (client.socket.destroyed) return;
    client.socket.write(encodeJson(type, data));
  }

  function broadcast(type, data, exceptClientId) {
    for (const client of clients.values()) {
      if (client.id === exceptClientId) continue;
      send(client, type, data);
    }
  }

  function stats() {
    return {
      connectedClients: clients.size,
      clients: [...clients.values()].map((client) => ({
        id: client.id,
        connectedAt: client.connectedAt,
      })),
    };
  }

  return { add, broadcast, send, stats };
}

function isWebSocketUpgrade(req) {
  return (
    req.headers.upgrade?.toLowerCase() === "websocket" &&
    req.headers.connection?.toLowerCase().includes("upgrade") &&
    Boolean(req.headers["sec-websocket-key"])
  );
}

module.exports = {
  createAcceptKey,
  createWebSocketHub,
  decodeFrames,
  encodeClose,
  encodeFrame,
  encodeJson,
  encodeText,
  isWebSocketUpgrade,
};
