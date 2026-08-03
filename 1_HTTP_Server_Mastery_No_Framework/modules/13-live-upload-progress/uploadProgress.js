const fs = require("fs");
const path = require("path");

function sanitizeFilename(filename) {
  return path.basename(filename || "upload.bin").replace(/[^\w.-]/g, "_");
}

function createProgressSnapshot({ uploadId, fileName, receivedBytes, totalBytes, startedAt, done = false }) {
  const elapsedMs = Math.max(Date.now() - startedAt, 1);
  const bytesPerSecond = Math.round((receivedBytes / elapsedMs) * 1000);
  const percent = totalBytes ? Math.min(100, Number(((receivedBytes / totalBytes) * 100).toFixed(2))) : null;

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

function streamUploadWithProgress(req, options) {
  const {
    uploadDir,
    uploadId,
    fileName,
    maxBytes = 5_000_000,
    publish,
  } = options;

  return new Promise((resolve, reject) => {
    const safeName = sanitizeFilename(fileName);
    const savedAs = `${Date.now()}-${uploadId}-${safeName}`;
    const outputPath = path.join(uploadDir, savedAs);
    const totalBytes = Number(req.headers["content-length"] || 0) || null;
    const startedAt = Date.now();
    let receivedBytes = 0;
    let lastPublishAt = 0;
    let failed = false;

    fs.mkdirSync(uploadDir, { recursive: true });
    const output = fs.createWriteStream(outputPath);

    function publishProgress(done = false) {
      const now = Date.now();
      if (!done && now - lastPublishAt < 50) return;
      lastPublishAt = now;
      publish("upload.progress", createProgressSnapshot({
        uploadId,
        fileName: safeName,
        receivedBytes,
        totalBytes,
        startedAt,
        done,
      }));
    }

    req.on("data", (chunk) => {
      receivedBytes += chunk.length;

      if (receivedBytes > maxBytes) {
        failed = true;
        output.destroy();
        reject(Object.assign(new Error("Upload too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }

      output.write(chunk);
      publishProgress(false);
    });

    req.on("end", () => {
      if (failed) return;
      output.end(() => {
        publishProgress(true);
        resolve({
          uploadId,
          fileName: safeName,
          savedAs,
          path: outputPath,
          size: receivedBytes,
          totalBytes,
          elapsedMs: Date.now() - startedAt,
        });
      });
    });

    req.on("error", (err) => {
      failed = true;
      output.destroy();
      reject(err);
    });

    output.on("error", (err) => {
      failed = true;
      reject(err);
    });
  });
}

module.exports = { createProgressSnapshot, streamUploadWithProgress };
