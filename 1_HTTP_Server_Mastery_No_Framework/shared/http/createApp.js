// app/createApp.js
const { createRouter } = require("../router/router");
const { compose } = require("./middleware");

function createApp() {
  const middlewares = [];
  const router = createRouter();

  return {
    use(fn) {
      middlewares.push(fn);
    },
    get(path, handler) {
      router.add("GET", path, handler);
    },
    post(path, handler) {
      router.add("POST", path, handler);
    },
    handle(req, res) {
      // Parse URL + query using WHATWG URL
      const fullUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      req.path = fullUrl.pathname;
      req.query = Object.fromEntries(fullUrl.searchParams.entries());

      // Route middleware at the end: only runs if previous middleware calls next()
      const routeMiddleware = (req, res, next) => {
        const match = router.match(req.method, req.path);
        if (!match) return next(); // fall through (404 handler later)
        req.params = match.params;
        return match.handler(req, res);
      };

      const fn = compose([...middlewares, routeMiddleware]);
      fn(req, res);
    },
  };
}

module.exports = { createApp };
