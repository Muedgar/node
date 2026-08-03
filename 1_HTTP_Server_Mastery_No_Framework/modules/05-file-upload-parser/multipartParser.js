const fs = require("fs");
const path = require("path");

function createHttpError(statusCode, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, details);
  return err;
}

function getBoundary(contentType) {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  return match ? match[1] || match[2] : null;
}

function sanitizeFilename(filename) {
  return path.basename(filename).replace(/[^\w.-]/g, "_");
}

function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function trimMultipartSegment(segment) {
  let output = segment;

  if (output.subarray(0, 2).equals(Buffer.from("\r\n"))) {
    output = output.subarray(2);
  }

  if (output.subarray(0, 2).equals(Buffer.from("--"))) {
    output = output.subarray(2);
  }

  if (output.subarray(output.length - 2).equals(Buffer.from("\r\n"))) {
    output = output.subarray(0, output.length - 2);
  }

  return output;
}

function parsePartHeaders(headerBuffer) {
  const headers = {};
  const lines = headerBuffer.toString("latin1").split("\r\n").filter(Boolean);

  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[key] = value;
  }

  return headers;
}

function parseContentDisposition(value) {
  const result = {};
  const typeEnd = value.indexOf(";");
  result.type = (typeEnd === -1 ? value : value.slice(0, typeEnd)).trim().toLowerCase();

  const pairs = value.matchAll(/;\s*([^=]+)="([^"]*)"/g);
  for (const pair of pairs) {
    result[pair[1].trim()] = pair[2];
  }

  return result;
}

function addField(fields, name, value) {
  if (fields[name] === undefined) {
    fields[name] = value;
  } else if (Array.isArray(fields[name])) {
    fields[name].push(value);
  } else {
    fields[name] = [fields[name], value];
  }
}

function readRequestBuffer(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];
    let failed = false;

    req.on("data", (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBodyBytes) {
        failed = true;
        chunks.length = 0;
        reject(
          createHttpError(413, "Multipart body too large", {
            limitBytes: maxBodyBytes,
            receivedBytes: totalBytes,
          })
        );
        return;
      }

      if (!failed) chunks.push(chunk);
    });

    req.on("end", () => {
      if (failed) return;
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

async function parseMultipartForm(req, options) {
  const {
    uploadDir,
    maxBodyBytes = 2_000_000,
    maxFileBytes = 1_000_000,
  } = options;

  const contentType = req.headers["content-type"] || "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw createHttpError(415, "Expected Content-Type: multipart/form-data", {
      receivedContentType: contentType || null,
    });
  }

  const boundary = getBoundary(contentType);
  if (!boundary) {
    throw createHttpError(400, "Missing multipart boundary");
  }

  await fs.promises.mkdir(uploadDir, { recursive: true });

  const body = await readRequestBuffer(req, maxBodyBytes);
  const delimiter = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const segments = splitBuffer(body, delimiter);
  const fields = {};
  const files = [];

  for (const rawSegment of segments) {
    const segment = trimMultipartSegment(rawSegment);
    if (segment.length === 0) continue;

    const headerEnd = segment.indexOf(headerSeparator);
    if (headerEnd === -1) continue;

    const headers = parsePartHeaders(segment.subarray(0, headerEnd));
    const content = segment.subarray(headerEnd + headerSeparator.length);
    const disposition = headers["content-disposition"];
    if (!disposition) continue;

    const partInfo = parseContentDisposition(disposition);
    if (partInfo.type !== "form-data" || !partInfo.name) continue;

    if (!partInfo.filename) {
      addField(fields, partInfo.name, content.toString("utf8"));
      continue;
    }

    if (content.length > maxFileBytes) {
      throw createHttpError(413, `File too large: ${partInfo.filename}`, {
        fileName: partInfo.filename,
        limitBytes: maxFileBytes,
        receivedBytes: content.length,
      });
    }

    const safeName = sanitizeFilename(partInfo.filename);
    const savedAs = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
    const outputPath = path.join(uploadDir, savedAs);

    await fs.promises.writeFile(outputPath, content);

    files.push({
      field: partInfo.name,
      originalName: partInfo.filename,
      savedAs,
      size: content.length,
      contentType: headers["content-type"] || "application/octet-stream",
    });
  }

  return {
    boundary,
    fields,
    files,
    limits: {
      maxBodyBytes,
      maxFileBytes,
    },
  };
}

module.exports = { getBoundary, parseMultipartForm, sanitizeFilename };
