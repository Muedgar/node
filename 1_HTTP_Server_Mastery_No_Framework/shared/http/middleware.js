// app/middleware.js
function compose(middlewares) {
  return function run(req, res) {
    let idx = -1;

    function next(err) {
      idx += 1;

      if (err) {
        // Basic error handler: end request
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Middleware error", detail: String(err) }));
        return;
      }

      const fn = middlewares[idx];
      if (!fn) return; // done

      // If response already ended, stop.
      if (res.writableEnded) return;

      // Middleware signature: (req, res, next) OR (req, res)
      if (fn.length >= 3) fn(req, res, next);
      else fn(req, res);
    }

    next();
  };
}

module.exports = { compose };