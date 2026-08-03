// server.js
const http = require("http");
const path = require("path");

const { createApp } = require("./shared/http/createApp");
const { staticFiles } = require("./shared/files/static");
const { jsonBody } = require("./shared/body/jsonBody");
const { cookieParser } = require("./shared/auth/cookies");
const { sessionMiddleware } = require("./shared/auth/sessions");
const { multipartUpload } = require("./shared/files/multipart");

const app = createApp();

/**
 * 10) Custom middleware system (chain functions manually)
 * We'll stack middleware in order.
 */

// 8) Cookie parser
app.use(cookieParser());

// 9) Simple session store (in memory)
app.use(sessionMiddleware());

// 3) JSON body parser (raw stream)
app.use(jsonBody({ limitBytes: 1_000_000 })); // 1MB

// 5) Static file server
app.use(
  staticFiles({
    rootDir: path.join(__dirname, "public"),
    urlPrefix: "/public",
  })
);

// 2) Manual routing system
// Basic home route
app.get("/", (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    `<h1>Pure Node Mini Server</h1>
     <ul>
       <li><a href="/public/index.html">Static file: /public/index.html</a></li>
       <li><a href="/download/hello.txt">Download: /download/hello.txt</a></li>
       <li><a href="/whoami">Session + cookies demo</a></li>
     </ul>`
  );
});

// 4) URL query parser (built-in URL)
app.get("/echo", (req, res) => {
  // req.query is set by our core request parsing (see createApp)
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ path: req.path, query: req.query }, null, 2));
});

// JSON API example (POST)
app.post("/api/hello", (req, res) => {
  // req.body set by jsonBody middleware if Content-Type is application/json
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, youSent: req.body ?? null }, null, 2));
});

// 6) File download server (safe path inside /public)
app.get("/download/:file", (req, res) => {
  const fileName = req.params.file;
  const filePath = path.join(__dirname, "public", fileName);
  // use helper that streams + sets attachment headers
  require("./shared/files/static").sendDownload(res, filePath, fileName);
});

// 9) session demo
app.get("/whoami", (req, res) => {
  const session = req.session;
  session.views = (session.views || 0) + 1;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify(
      {
        sessionId: req.sessionId,
        views: session.views,
        cookies: req.cookies,
      },
      null,
      2
    )
  );
});

// 7) File upload handler (multipart parsing manually)
app.post("/upload", async (req, res) => {
  try {
    const result = await multipartUpload(req, {
      uploadDir: path.join(__dirname, "uploads"),
      maxFileBytes: 5_000_000, // 5MB
      maxBodyBytes: 7_000_000, // entire request safety cap
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (err) {
    res.statusCode = err.statusCode || 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: err.message }, null, 2));
  }
});

// Not found handler
app.use((req, res) => {
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Not found", path: req.url }, null, 2));
});

// 1) Basic HTTP server using `http`
const server = http.createServer((req, res) => app.handle(req, res));

server.listen(3001, () => {
  console.log("✅ Server running at http://localhost:3001");
  console.log("Static: http://localhost:3001/public/index.html");
});
