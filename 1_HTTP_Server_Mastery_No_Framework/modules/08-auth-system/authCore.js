const crypto = require("crypto");

const COOKIE_NAME = "sid";
const COOKIE_SECRET = "module-08-learning-secret-change-me";
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;

    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!key) continue;

    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function sign(value) {
  return crypto.createHmac("sha256", COOKIE_SECRET).update(value).digest("base64url");
}

function signedCookieValue(value) {
  return `${value}.${sign(value)}`;
}

function verifySignedCookie(cookieValue) {
  if (!cookieValue || !cookieValue.includes(".")) return null;

  const separator = cookieValue.lastIndexOf(".");
  const value = cookieValue.slice(0, separator);
  const signature = cookieValue.slice(separator + 1);
  const expected = sign(value);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  return value;
}

function sessionCookie(sessionId) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(signedCookieValue(sessionId))}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=3600",
  ].join("; ");
}

function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString("hex");

  return {
    algorithm: "pbkdf2",
    digest: PASSWORD_DIGEST,
    iterations: PASSWORD_ITERATIONS,
    keyLength: PASSWORD_KEY_LENGTH,
    salt,
    hash,
  };
}

function verifyPassword(password, record) {
  const hash = crypto
    .pbkdf2Sync(password, record.salt, record.iterations, record.keyLength, record.digest)
    .toString("hex");

  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(record.hash, "hex");

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createAuthStore() {
  const usersByEmail = new Map();
  const sessions = new Map();

  function safeUser(user) {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  function register(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail.includes("@")) {
      throw createHttpError(400, "A valid email is required");
    }

    if (typeof password !== "string" || password.length < 8) {
      throw createHttpError(400, "Password must be at least 8 characters");
    }

    if (usersByEmail.has(normalizedEmail)) {
      throw createHttpError(409, "User already exists");
    }

    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    usersByEmail.set(user.email, user);
    return safeUser(user);
  }

  function login(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const user = usersByEmail.get(normalizedEmail);

    if (!user || !verifyPassword(String(password || ""), user.password)) {
      throw createHttpError(401, "Invalid email or password");
    }

    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      userId: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    };

    sessions.set(sessionId, session);
    return { session, user: safeUser(user) };
  }

  function getSessionFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = verifySignedCookie(cookies[COOKIE_NAME]);
    if (!sessionId) return null;

    return sessions.get(sessionId) || null;
  }

  function destroySession(sessionId) {
    if (sessionId) sessions.delete(sessionId);
  }

  function requireUser(req) {
    const session = getSessionFromRequest(req);
    if (!session) {
      throw createHttpError(401, "Authentication required");
    }

    return session;
  }

  return {
    destroySession,
    getSessionFromRequest,
    login,
    register,
    requireUser,
  };
}

module.exports = {
  COOKIE_NAME,
  clearSessionCookie,
  createAuthStore,
  createHttpError,
  parseCookies,
  sessionCookie,
  verifySignedCookie,
};
