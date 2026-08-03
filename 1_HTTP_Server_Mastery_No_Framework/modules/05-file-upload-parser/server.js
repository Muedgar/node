const http = require("http");
const path = require("path");
const { parseMultipartForm } = require("./multipartParser");

const HOST = "127.0.0.1";
const PORT = 3105;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MAX_BODY_BYTES = 4_000;
const MAX_FILE_BYTES = 1_024;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendHtml(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function uploadForm() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Module 05 Upload Parser</title>
  </head>
  <body>
    <h1>Module 05 - File Upload Parser</h1>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <p><label>Title <input name="title" value="Pure Node upload"></label></p>
      <p><label>Tag <input name="tag" value="node"></label></p>
      <p><label>Tag <input name="tag" value="multipart"></label></p>
      <p><label>Files <input name="files" type="file" multiple></label></p>
      <button type="submit">Upload</button>
    </form>
  </body>
</html>`;
}

async function handleUpload(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed",
      allowedMethods: ["POST"],
    });
  }

  try {
    const result = await parseMultipartForm(req, {
      uploadDir: UPLOAD_DIR,
      maxBodyBytes: MAX_BODY_BYTES,
      maxFileBytes: MAX_FILE_BYTES,
    });

    return sendJson(res, 201, {
      ok: true,
      uploadDir: UPLOAD_DIR,
      ...result,
    });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
      details: {
        receivedContentType: err.receivedContentType,
        fileName: err.fileName,
        limitBytes: err.limitBytes,
        receivedBytes: err.receivedBytes,
      },
    });
  }
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/") {
    return sendHtml(res, 200, uploadForm());
  }

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      module: "05-file-upload-parser",
    });
  }

  if (url.pathname === "/upload") {
    return handleUpload(req, res);
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Route not found",
    routes: ["/", "/health", "/upload"],
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("05 - File Upload Parser");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Open http://${HOST}:${PORT}/ for the upload form`);
});
