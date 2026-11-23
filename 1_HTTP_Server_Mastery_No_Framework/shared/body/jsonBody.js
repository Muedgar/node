// Compatibility adapter for the original combined demo.
const {
  json,
} = require("../../modules/router/routes-fundamentals/03-body-parser");
function jsonBody({ limitBytes = 1_000_000 } = {}) {
  const parse = json({ limit: limitBytes });
  return (req, res, next) =>
    parse(req, res, next).catch((error) => {
      if (res.writableEnded || res.destroyed) return;
      res.statusCode = error.statusCode || 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: error.statusCode ? error.message : "Internal server error",
        })
      );
    });
}
module.exports = { jsonBody };
