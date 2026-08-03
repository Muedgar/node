function parseContentType(headerValue) {
  const [type, ...params] = String(headerValue || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    type: (type || "").toLowerCase(),
    params,
  };
}

function isJsonContentType(headerValue) {
  const { type } = parseContentType(headerValue);
  return type === "application/json" || type.endsWith("+json");
}

function createHttpError(statusCode, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, details);
  return err;
}

function parseJsonBody(req, options = {}) {
  const {
    limitBytes = 1_000_000,
    requireJsonContentType = true,
    allowEmpty = true,
  } = options;

  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"];

    if (requireJsonContentType && !isJsonContentType(contentType)) {
      reject(
        createHttpError(415, "Expected Content-Type: application/json", {
          receivedContentType: contentType || null,
        })
      );
      return;
    }

    let totalBytes = 0;
    const chunks = [];
    let settled = false;

    function fail(err) {
      if (settled) return;
      settled = true;
      reject(err);
    }

    req.on("data", (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > limitBytes) {
        fail(
          createHttpError(413, "JSON body too large", {
            limitBytes,
            receivedBytes: totalBytes,
          })
        );
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;

      const raw = Buffer.concat(chunks).toString("utf8");
      const trimmed = raw.trim();

      if (!trimmed) {
        if (allowEmpty) {
          resolve({
            body: null,
            raw,
            bytes: totalBytes,
            empty: true,
          });
          return;
        }

        reject(createHttpError(400, "Empty JSON body is not allowed"));
        return;
      }

      try {
        resolve({
          body: JSON.parse(trimmed),
          raw,
          bytes: totalBytes,
          empty: false,
        });
      } catch (err) {
        reject(
          createHttpError(400, "Invalid JSON body", {
            parserMessage: err.message,
            bytes: totalBytes,
          })
        );
      }
    });

    req.on("error", fail);
    req.on("aborted", () => {
      fail(createHttpError(400, "Request body stream was aborted"));
    });
  });
}

module.exports = { isJsonContentType, parseJsonBody };
