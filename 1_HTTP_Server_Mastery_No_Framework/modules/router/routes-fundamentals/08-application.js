const http = require("node:http");
const { createRouter } = require("./07-router");
const { prepare, decorate } = require("./05-http-context");
const { json, urlencoded } = require("./03-body-parser");
const { multipart } = require("./04-upload-parser");
const { getErrorStatus } = require("./10-validation");

// Only the outer application owns final HTTP fallbacks; nested routers may still fall through.
function finishRequest(req, res, error, match = { type: "not-found" }) {
  if (res.writableEnded || res.destroyed) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (error) {
    const status = getErrorStatus(error);
    return res
      .status(status)
      .json({ error: status < 500 ? error.message : "Internal server error" });
  }
  if (match.type === "method-not-allowed") {
    res.setHeader("Allow", match.allowedMethods.join(", "));
    if (req.method === "OPTIONS") return res.status(204).end();
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(404).json({ error: "Route not found" });
}

// Connect our router to node:http while leaving project entry points in familiar Express form.
function createApp() {
  const app = createRouter();

  // A fresh server makes tests independent and preserves Node's streaming response objects.
  app.createServer = () => {
    const server = http.createServer((req, res) => {
      decorate(req, res);
      // This callback is the final continuation for normal, error and rejected-promise paths.
      const finish = (error, match) => finishRequest(req, res, error, match);
      let error;
      try {
        prepare(req);
      } catch (failure) {
        error = failure;
        req.path = "/";
        req.params = {};
      }
      app.handle(req, res, finish, error).catch(finish);
    });
    server.requestTimeout = 15_000;
    server.headersTimeout = 10_000;
    server.keepAliveTimeout = 5_000;
    return server;
  };

  // Keep listen() as a thin pass-through so Node owns binding and server lifecycle.
  app.listen = (...args) => app.createServer().listen(...args);
  return app;
}

createApp.Router = createRouter;
createApp.json = json;
createApp.urlencoded = urlencoded;
createApp.multipart = multipart;
module.exports = createApp;
