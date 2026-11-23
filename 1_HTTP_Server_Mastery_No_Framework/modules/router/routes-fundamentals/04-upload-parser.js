const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { readBody, mediaType, checkBodyLimit } = require("./03-body-parser");
const { assertInput } = require("./10-validation");

// Multipart bodies identify their separator in the Content-Type header.
function getBoundary(contentType) {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(
    contentType || ""
  );
  return match ? (match[1] || match[2]).trim() : null;
}

// Client filenames are labels, not trusted filesystem paths (including Windows paths).
function sanitizeFilename(filename) {
  return (
    path.basename(filename.replace(/\\/g, "/")).replace(/[^\w.-]/g, "_") ||
    "upload"
  );
}

// Fail invalid server configuration before accepting or writing uploaded data.
function uploadOptions(options = {}) {
  const settings = {
    maxBodyBytes: 200_000,
    maxFileBytes: 100_000,
    maxParts: 20,
    ...options,
  };
  if (typeof settings.uploadDir !== "string" || !settings.uploadDir)
    throw new TypeError("uploadDir is required");
  for (const limit of [
    settings.maxBodyBytes,
    settings.maxFileBytes,
    settings.maxParts,
  ])
    checkBodyLimit(limit);
  return settings;
}

// Binary content may contain a boundary prefix; only a complete delimiter ends a part.
function findBoundary(body, marker, start) {
  let index = body.indexOf(marker, start);
  while (index !== -1) {
    const suffix = body
      .subarray(index + marker.length, index + marker.length + 2)
      .toString();
    const afterClosing = body
      .subarray(index + marker.length + 2, index + marker.length + 4)
      .toString();
    if (
      suffix === "\r\n" ||
      (suffix === "--" && (afterClosing === "" || afterClosing === "\r\n"))
    )
      return index;
    index = body.indexOf(marker, index + marker.length);
  }
  return -1;
}

// Each part has its own headers; keep parsing separate from boundary navigation.
function parseHeaders(buffer) {
  assertInput(buffer.length <= 8192, 400, "Part headers too large");
  const headers = Object.create(null);
  for (const line of buffer.toString("latin1").split("\r\n")) {
    const separator = line.indexOf(":");
    assertInput(separator > 0, 400, "Malformed part header");
    headers[line.slice(0, separator).trim().toLowerCase()] = line
      .slice(separator + 1)
      .trim();
  }
  return headers;
}

// Split bytes without converting file contents to text, which would corrupt binary uploads.
function parseParts(body, boundary, maxParts) {
  const opening = Buffer.from(`--${boundary}\r\n`);
  const closing = Buffer.from(`--${boundary}--`);
  const marker = Buffer.from(`\r\n--${boundary}`);
  if (
    body.equals(closing) ||
    body.equals(Buffer.concat([closing, Buffer.from("\r\n")]))
  )
    return [];
  assertInput(
    body.subarray(0, opening.length).equals(opening),
    400,
    "Malformed multipart opening"
  );
  const parts = [];
  let cursor = opening.length;
  for (;;) {
    assertInput(parts.length < maxParts, 413, "Too many multipart parts");
    const end = findBoundary(body, marker, cursor);
    const headerEnd = body.indexOf("\r\n\r\n", cursor);
    assertInput(
      end !== -1 && headerEnd >= cursor && headerEnd < end,
      400,
      "Malformed multipart part"
    );
    parts.push({
      headers: parseHeaders(body.subarray(cursor, headerEnd)),
      content: body.subarray(headerEnd + 4, end),
    });
    cursor = end + marker.length;
    if (body.subarray(cursor, cursor + 2).toString() === "--") return parts;
    cursor += 2;
  }
}

// Validate every part before creating files so a later oversized file leaves no earlier files.
function collectParts(parts, maxFileBytes) {
  const fields = Object.create(null);
  const files = [];
  for (const { headers, content } of parts) {
    const disposition = headers["content-disposition"] || "";
    const name = /(?:^|;)\s*name="([^"]+)"/i.exec(disposition)?.[1];
    const filename = /(?:^|;)\s*filename="([^"]*)"/i.exec(disposition)?.[1];
    assertInput(
      /^form-data(?:;|$)/i.test(disposition) && name,
      400,
      "Invalid Content-Disposition"
    );
    if (filename === undefined) {
      const value = content.toString("utf8");
      fields[name] =
        fields[name] === undefined ? value : [].concat(fields[name], value);
    } else if (filename) {
      assertInput(content.length <= maxFileBytes, 413, "File too large");
      files.push({
        content,
        field: name,
        originalName: filename,
        savedAs: `${randomUUID()}-${sanitizeFilename(filename)}`,
        size: content.length,
        contentType: headers["content-type"] || "application/octet-stream",
      });
    }
  }
  return { fields, files };
}

// Exclusive creation avoids overwrites; track partial writes so failures can remove them too.
async function saveFiles(uploadDir, files) {
  if (!files.length) return;
  await fs.mkdir(uploadDir, { recursive: true });
  const written = [];
  try {
    for (const file of files) {
      const handle = await fs.open(path.join(uploadDir, file.savedAs), "wx");
      written.push(file);
      try {
        await handle.writeFile(file.content);
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    try {
      await removeUploadedFiles(uploadDir, written);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Upload and cleanup failed"
      );
    }
    throw error;
  }
}

// The complete operation is deliberately four steps: read, split, validate, save.
async function parseMultipartForm(req, options) {
  const { uploadDir, maxBodyBytes, maxFileBytes, maxParts } =
    uploadOptions(options);
  assertInput(
    mediaType(req) === "multipart/form-data",
    415,
    "Expected Content-Type: multipart/form-data"
  );
  const boundary = getBoundary(req.headers["content-type"]);
  assertInput(
    boundary && boundary.length <= 70 && !/[\r\n]/.test(boundary),
    400,
    "Invalid multipart boundary"
  );
  const body = await readBody(req, maxBodyBytes);
  const { fields, files } = collectParts(
    parseParts(body, boundary, maxParts),
    maxFileBytes
  );
  await saveFiles(uploadDir, files);
  return {
    boundary,
    fields,
    files: files.map(({ content, ...metadata }) => metadata),
    limits: { maxBodyBytes, maxFileBytes },
  };
}

// Adapt parsing to Express-style middleware while leaving other media types untouched.
function multipart(options) {
  const settings = uploadOptions(options);
  return async (req, res, next) => {
    if (mediaType(req) !== "multipart/form-data") return next();
    const parsed = await parseMultipartForm(req, settings);
    req.body = parsed.fields;
    req.files = parsed.files;
    return next();
  };
}

// Metadata commits can fail after writing files; give controllers one shared rollback operation.
async function removeUploadedFiles(uploadDir, files) {
  const results = await Promise.allSettled(
    files.map((file) =>
      fs.rm(path.join(uploadDir, path.basename(file.savedAs)), { force: true })
    )
  );
  const errors = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (errors.length)
    throw new AggregateError(errors, "Could not remove uploaded files");
}

// Large raw uploads need backpressure: await each disk write instead of buffering the body.
// Keeping the request open on early exit lets the HTTP layer return a useful 413 response.
async function saveRequestFile(
  req,
  filename,
  { limitBytes = 5_000_000, onProgress = () => {} } = {}
) {
  checkBodyLimit(limitBytes);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const file = await fs.open(filename, "wx");
  let receivedBytes = 0;
  try {
    try {
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        receivedBytes += chunk.length;
        assertInput(receivedBytes <= limitBytes, 413, "Upload too large");
        await file.writeFile(chunk);
        onProgress(receivedBytes);
      }
    } finally {
      await file.close();
    }
    return receivedBytes;
  } catch (error) {
    req.resume();
    try {
      await fs.rm(filename, { force: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Upload and cleanup failed"
      );
    }
    throw error;
  }
}

module.exports = {
  saveRequestFile,
  getBoundary,
  sanitizeFilename,
  parseMultipartForm,
  multipart,
  removeUploadedFiles,
};
