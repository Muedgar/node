// app/multipart.js
const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getBoundary(contentType) {
  // content-type: multipart/form-data; boundary=----WebKitFormBoundary...
  const m = /boundary=(.+)$/i.exec(contentType || "");
  return m ? m[1] : null;
}

function parsePartHeaders(headerText) {
  const headers = {};
  const lines = headerText.split("\r\n").filter(Boolean);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    headers[k] = v;
  }
  return headers;
}

function parseContentDisposition(v) {
  // form-data; name="file"; filename="a.png"
  const out = {};
  const parts = v.split(";").map((s) => s.trim());
  for (const p of parts) {
    const [k, raw] = p.split("=");
    if (!raw) continue;
    out[k] = raw.replace(/^"|"$/g, "");
  }
  return out;
}

async function readRequestBuffer(req, { maxBodyBytes }) {
  let total = 0;
  const chunks = [];

  return await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        const err = new Error("Multipart body too large");
        err.statusCode = 413;
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function multipartUpload(req, { uploadDir, maxFileBytes = 5_000_000, maxBodyBytes = 7_000_000 }) {
  const ct = req.headers["content-type"] || "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    const err = new Error("Expected multipart/form-data");
    err.statusCode = 400;
    throw err;
  }

  const boundary = getBoundary(ct);
  if (!boundary) {
    const err = new Error("Missing multipart boundary");
    err.statusCode = 400;
    throw err;
  }

  ensureDir(uploadDir);

  const buf = await readRequestBuffer(req, { maxBodyBytes });

  const boundaryBuf = Buffer.from("--" + boundary);
  const endBoundaryBuf = Buffer.from("--" + boundary + "--");

  // Split parts manually by searching boundaries in buffer
  // Convert to binary string for simpler split (ok for learning, not ideal prod)
  const raw = buf.toString("binary");

  const boundaryStr = boundaryBuf.toString("binary");
  const endBoundaryStr = endBoundaryBuf.toString("binary");

  // Remove any leading data before first boundary
  let body = raw;
  const first = body.indexOf(boundaryStr);
  if (first === -1) {
    const err = new Error("Boundary not found in body");
    err.statusCode = 400;
    throw err;
  }
  body = body.slice(first);

  // Split by boundary markers
  const segments = body.split(boundaryStr);

  const files = [];
  const fields = {};

  for (let seg of segments) {
    // seg contains: \r\n headers \r\n\r\n content \r\n-- or end
    if (!seg) continue;
    if (seg.startsWith("--")) continue; // end marker segment
    if (seg.startsWith("\r\n")) seg = seg.slice(2);

    // ignore final end boundary
    if (seg.includes(endBoundaryStr)) continue;

    const headerEnd = seg.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerText = seg.slice(0, headerEnd);
    let content = seg.slice(headerEnd + 4);

    // content often ends with \r\n
    if (content.endsWith("\r\n")) content = content.slice(0, -2);

    const headers = parsePartHeaders(headerText);
    const cd = headers["content-disposition"];
    if (!cd) continue;

    const disp = parseContentDisposition(cd);
    const name = disp.name;
    const filename = disp.filename;

    if (!name) continue;

    if (filename) {
      // file part
      const fileBytes = Buffer.from(content, "binary");
      if (fileBytes.length > maxFileBytes) {
        const err = new Error(`File too large: ${filename}`);
        err.statusCode = 413;
        throw err;
      }

      // sanitize filename (very basic)
      const safeName = path.basename(filename).replace(/[^\w.\-]/g, "_");
      const outPath = path.join(uploadDir, `${Date.now()}_${safeName}`);

      fs.writeFileSync(outPath, fileBytes);

      files.push({
        field: name,
        originalName: filename,
        savedAs: path.basename(outPath),
        size: fileBytes.length,
      });
    } else {
      // text field
      fields[name] = Buffer.from(content, "binary").toString("utf8");
    }
  }

  return { fields, files };
}

module.exports = { multipartUpload };