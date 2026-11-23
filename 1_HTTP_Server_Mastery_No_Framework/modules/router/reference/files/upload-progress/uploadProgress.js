const {
  saveRequestFile,
  sanitizeFilename,
} = require("../../../routes-fundamentals/04-upload-parser");
const path = require("path");

function createProgressSnapshot({
  uploadId,
  fileName,
  receivedBytes,
  totalBytes,
  startedAt,
  done = false,
}) {
  const elapsedMs = Math.max(Date.now() - startedAt, 1);
  const bytesPerSecond = Math.round((receivedBytes / elapsedMs) * 1000);
  const percent = totalBytes
    ? Math.min(100, Number(((receivedBytes / totalBytes) * 100).toFixed(2)))
    : null;

  return {
    uploadId,
    fileName,
    receivedBytes,
    totalBytes,
    percent,
    bytesPerSecond,
    done,
  };
}

// The shared writer handles bytes, backpressure, limits and rollback; this lesson adds progress.
async function streamUploadWithProgress(req, options) {
  const {
    uploadDir,
    uploadId,
    fileName,
    maxBytes = 5_000_000,
    publish,
  } = options;
  const safeName = sanitizeFilename(fileName || "upload.bin");
  const savedAs = `${Date.now()}-${sanitizeFilename(uploadId)}-${safeName}`;
  const outputPath = path.join(uploadDir, savedAs);
  const totalBytes = Number(req.headers["content-length"] || 0) || null;
  const startedAt = Date.now();
  let lastPublishAt = 0;

  // Limit event frequency so progress reporting does not dominate upload work.
  function report(receivedBytes, done = false) {
    const now = Date.now();
    if (!done && now - lastPublishAt < 50) return;
    lastPublishAt = now;
    publish(
      "upload.progress",
      createProgressSnapshot({
        uploadId,
        fileName: safeName,
        receivedBytes,
        totalBytes,
        startedAt,
        done,
      })
    );
  }

  const receivedBytes = await saveRequestFile(req, outputPath, {
    limitBytes: maxBytes,
    onProgress: report,
  });
  report(receivedBytes, true);
  return {
    uploadId,
    fileName: safeName,
    savedAs,
    path: outputPath,
    size: receivedBytes,
    totalBytes,
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = { createProgressSnapshot, streamUploadWithProgress };
