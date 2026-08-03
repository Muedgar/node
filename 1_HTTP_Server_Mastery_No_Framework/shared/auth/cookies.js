// app/cookies.js
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;

  // "a=1; b=hello"
  const parts = cookieHeader.split(";");

  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function cookieParser() {
  return (req, res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  };
}

module.exports = { cookieParser, parseCookies };