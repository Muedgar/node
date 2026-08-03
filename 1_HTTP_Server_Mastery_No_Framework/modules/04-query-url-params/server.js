const http = require("http");
const {
  matchPath,
  normalizeQuery,
  parseFileSearchQuery,
} = require("./urlTools");

const HOST = "127.0.0.1";
const PORT = 3104;

const files = [
  { userId: "42", fileId: "f-100", name: "node-notes.md", size: 1200, tags: ["node", "http"], archived: false, createdAt: "2026-05-01" },
  { userId: "42", fileId: "f-101", name: "router-plan.txt", size: 800, tags: ["routing", "http"], archived: false, createdAt: "2026-05-03" },
  { userId: "42", fileId: "f-102", name: "old-upload.log", size: 4000, tags: ["upload", "logs"], archived: true, createdAt: "2026-04-20" },
  { userId: "42", fileId: "f-103", name: "json-parser-test.json", size: 620, tags: ["json", "node"], archived: false, createdAt: "2026-05-08" },
  { userId: "7", fileId: "f-200", name: "other-user-file.txt", size: 300, tags: ["private"], archived: false, createdAt: "2026-05-02" },
];

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function compareValues(a, b, order) {
  if (a < b) return order === "asc" ? -1 : 1;
  if (a > b) return order === "asc" ? 1 : -1;
  return 0;
}

function searchFiles(userId, parsedQuery) {
  const filtered = files
    .filter((file) => file.userId === userId)
    .filter((file) => file.archived === parsedQuery.archived)
    .filter((file) => {
      if (!parsedQuery.q) return true;
      return file.name.toLowerCase().includes(parsedQuery.q);
    })
    .filter((file) => {
      if (parsedQuery.tags.length === 0) return true;
      return parsedQuery.tags.every((tag) => file.tags.includes(tag));
    })
    .sort((a, b) => compareValues(a[parsedQuery.sort], b[parsedQuery.sort], parsedQuery.order));

  const start = (parsedQuery.page - 1) * parsedQuery.limit;
  const end = start + parsedQuery.limit;

  return {
    total: filtered.length,
    page: parsedQuery.page,
    limit: parsedQuery.limit,
    totalPages: Math.max(1, Math.ceil(filtered.length / parsedQuery.limit)),
    items: filtered.slice(start, end),
  };
}

function createContext(req) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  return {
    url,
    pathname: url.pathname,
    query: normalizeQuery(url.searchParams),
  };
}

function handleUsersFiles(req, res, context, params) {
  if (req.method !== "GET") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed",
      allowedMethods: ["GET"],
    });
  }

  const parsedQuery = parseFileSearchQuery(context.query);
  const result = searchFiles(params.userId, parsedQuery);

  return sendJson(res, 200, {
    ok: true,
    routeParams: params,
    rawQuery: context.query,
    parsedQuery,
    result,
  });
}

function handleOneFile(req, res, context, params) {
  if (req.method !== "GET") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed",
      allowedMethods: ["GET"],
    });
  }

  const file = files.find((item) => item.userId === params.userId && item.fileId === params.fileId);

  if (!file) {
    return sendJson(res, 404, {
      ok: false,
      error: "File not found for route params",
      routeParams: params,
    });
  }

  return sendJson(res, 200, {
    ok: true,
    routeParams: params,
    rawQuery: context.query,
    file,
  });
}

function handleRequest(req, res) {
  try {
    const context = createContext(req);

    if (context.pathname === "/") {
      return sendJson(res, 200, {
        module: "04-query-url-params",
        routes: [
          "GET /health",
          "GET /users/:userId/files",
          "GET /users/:userId/files/:fileId",
        ],
        queryOptions: {
          tag: "repeatable, example: ?tag=node&tag=http",
          page: "positive integer, default 1",
          limit: "positive integer up to 20, default 5",
          sort: "name, size, or createdAt",
          order: "asc or desc",
          archived: "true or false",
          q: "case-insensitive filename search",
        },
      });
    }

    if (context.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        module: "04-query-url-params",
      });
    }

    const filesParams = matchPath("/users/:userId/files", context.pathname);
    if (filesParams) return handleUsersFiles(req, res, context, filesParams);

    const fileParams = matchPath("/users/:userId/files/:fileId", context.pathname);
    if (fileParams) return handleOneFile(req, res, context, fileParams);

    return sendJson(res, 404, {
      ok: false,
      error: "Route not found",
      path: context.pathname,
    });
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
    });
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log("04 - Query Params + URL Params");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Try http://${HOST}:${PORT}/users/42/files?tag=node&tag=http&sort=size&order=desc`);
});
