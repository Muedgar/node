// app/sessions.js
const crypto = require("crypto");

const store = new Map(); // sessionId -> object

function newSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

function sessionMiddleware({ cookieName = "sid" } = {}) {
  return (req, res, next) => {
    const sid = req.cookies?.[cookieName];

    let sessionId = sid && store.has(sid) ? sid : null;

    if (!sessionId) {
      sessionId = newSessionId();
      store.set(sessionId, { createdAt: Date.now() });

      // Set cookie
      // HttpOnly prevents JS access in browser
      res.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(sessionId)}; HttpOnly; Path=/`);
    }

    req.sessionId = sessionId;
    req.session = store.get(sessionId);

    next();
  };
}

module.exports = { sessionMiddleware };