// app/body.js
function jsonBody({ limitBytes = 1_000_000 } = {}) {
  return (req, res, next) => {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) return next();

    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "JSON payload too large" }));
        req.destroy(); // stop reading
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (res.writableEnded) return;
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        req.body = null;
        return next();
      }
      try {
        req.body = JSON.parse(raw);
        next();
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    req.on("error", (e) => next(e));
  };
}

module.exports = { jsonBody };