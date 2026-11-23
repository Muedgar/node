const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { PassThrough } = require("node:stream");
const { createMatcher } = require("../routes-fundamentals/01-matcher");
const {
  parseQuery,
  parseBoolean,
  parsePositiveInteger,
} = require("../routes-fundamentals/02-query-parser");
const { parseJsonBody } = require("../routes-fundamentals/03-body-parser");
const {
  parseMultipartForm,
} = require("../routes-fundamentals/04-upload-parser");
const { createStore } = require("../routes-fundamentals/09-file-store");
const mini = require("../routes-fundamentals/08-application");
const { start } = require("./http");

async function serve(t, app) {
  const server = await start(app);
  t.after(server.close);
  return server.request;
}
async function directory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "router-core-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
function input(contentType) {
  const req = new PassThrough();
  req.headers = { "content-type": contentType };
  return req;
}

test("matcher retains dynamic params, static precedence, 404 and 405", () => {
  const matcher = createMatcher();
  const dynamic = () => {};
  const fixed = () => {};
  matcher.get("/users/:id", dynamic);
  matcher.get("/users/new", fixed);
  assert.equal(matcher.match("GET", "/users/new").handler, fixed);
  assert.equal(matcher.match("GET", "/users/a%20b").params.id, "a b");
  assert.deepEqual(matcher.match("POST", "/users/1").allowedMethods, ["GET"]);
  assert.equal(matcher.match("GET", "/missing").type, "not-found");
  assert.throws(() => matcher.match("GET", "/users/%ZZ"), { statusCode: 400 });
});

test("query parser preserves repetitions and special keys; typed parsers are strict", () => {
  const query = parseQuery(
    new URLSearchParams("tag=node&tag=http&constructor=x&__proto__=y")
  );
  assert.equal(Object.getPrototypeOf(query), null);
  assert.deepEqual(query.tag, ["node", "http"]);
  assert.equal(query.constructor, "x");
  assert.equal(query.__proto__, "y");
  assert.equal(parseBoolean("false", "done", true), false);
  assert.throws(() => parseBoolean(["true", "false"], "done", false), {
    statusCode: 400,
  });
  assert.throws(() => parsePositiveInteger("1.2", "page", 1), {
    statusCode: 400,
  });
});

test("JSON low-level parser exposes bytes, empty policy and media type errors", async () => {
  const req = input("application/problem+json");
  const pending = parseJsonBody(req);
  req.end('{"name":"é"}');
  const result = await pending;
  assert.equal(result.body.name, "é");
  assert.equal(result.bytes, Buffer.byteLength(result.raw));
  const empty = input("application/json");
  const rejected = parseJsonBody(empty, { allowEmpty: false });
  empty.end();
  await assert.rejects(rejected, { statusCode: 400 });
  await assert.rejects(parseJsonBody(input("text/plain")), { statusCode: 415 });
});

test("body reader rejects oversize input and aborted requests", async () => {
  const req = input("application/json");
  const pending = parseJsonBody(req, { limitBytes: 4 });
  req.end('{"too":"big"}');
  await assert.rejects(pending, { statusCode: 413 });
  const aborted = input("application/json");
  const failure = parseJsonBody(aborted);
  aborted.destroy(new Error("Request body stream was aborted"));
  await assert.rejects(failure, { statusCode: 400 });
});

test("middleware ordering, early response and async next unwinding", async (t) => {
  const app = mini();
  const trace = [];
  app.use(async (req, res, next) => {
    trace.push("before");
    await next();
    trace.push("after");
  });
  app.get(
    "/",
    async (req, res, next) => {
      await Promise.resolve();
      trace.push("route");
      return next();
    },
    (req, res) => res.send("ok")
  );
  app.get(
    "/stop",
    (req, res) => res.status(401).send("stopped"),
    () => assert.fail("must stop")
  );
  const request = await serve(t, app);
  assert.equal((await request("/")).text, "ok");
  assert.deepEqual(trace, ["before", "route", "after"]);
  assert.equal((await request("/stop")).status, 401);
});

test("async and sync errors skip ordinary handlers and reach error middleware", async (t) => {
  const app = mini();
  app.get("/async", async () => {
    throw new Error("async failure");
  });
  app.get("/sync", () => {
    throw new Error("sync failure");
  });
  app.use((req, res, next) => assert.fail("error skips this"));
  app.use((error, req, res, next) =>
    res.status(418).json({ error: error.message })
  );
  const request = await serve(t, app);
  assert.equal((await request("/async")).json.error, "async failure");
  assert.equal((await request("/sync")).status, 418);
});

test("duplicate next is rejected rather than rerunning a normal layer", async (t) => {
  const app = mini();
  let runs = 0;
  app.use((req, res, next) => {
    next();
    next();
  });
  app.use((req, res, next) => {
    runs++;
  });
  app.use((error, req, res, next) => res.status(500).send(error.message));
  const request = await serve(t, app);
  assert.match((await request("/")).text, /more than once/);
  assert.equal(runs, 1);
});

test("child routers restore state before parent fallthrough and match segment boundaries", async (t) => {
  const app = mini();
  const child = mini.Router();
  child.use((req, res, next) => {
    req.params.child = "temporary";
    return next();
  });
  app.use("/api", child);
  app.get("/api/missing", (req, res) =>
    res.json({ path: req.path, baseUrl: req.baseUrl, params: req.params })
  );
  const request = await serve(t, app);
  assert.deepEqual((await request("/api/missing")).json, {
    path: "/api/missing",
    baseUrl: "",
    params: {},
  });
  assert.equal((await request("/apix")).status, 404);
});

test("nested mounts retain original URL and advertise methods", async (t) => {
  const app = mini();
  const api = mini.Router();
  const users = mini.Router();
  users.get("/:id", (req, res) =>
    res.json({
      id: req.params.id,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,
    })
  );
  api.use("/users", users);
  app.use("/api", api);
  const request = await serve(t, app);
  assert.deepEqual((await request("/api/users/42?a=1")).json, {
    id: "42",
    baseUrl: "/api/users",
    originalUrl: "/api/users/42?a=1",
  });
  assert.equal(
    (await request("/api/users/42", { method: "POST" })).status,
    405
  );
  assert.equal(
    (await request("/api/users/42", { method: "OPTIONS" })).headers.allow,
    "GET, HEAD, OPTIONS"
  );
});

test("HTTP helpers handle Unicode, HEAD, explicit OPTIONS and invalid path escapes", async (t) => {
  const app = mini();
  app.get("/", (req, res) => res.status(202).json({ word: "é" }));
  app.options("/custom", (req, res) => res.send("custom"));
  const request = await serve(t, app);
  const get = await request("/");
  assert.equal(
    Number(get.headers["content-length"]),
    Buffer.byteLength(get.text)
  );
  const head = await request("/", { method: "HEAD" });
  assert.equal(head.status, 202);
  assert.equal(head.text, "");
  assert.equal(
    (await request("/custom", { method: "OPTIONS" })).text,
    "custom"
  );
  assert.equal((await request("/bad%ZZ")).status, 400);
});

test("unhandled server errors do not expose internals", async (t) => {
  const app = mini();
  app.get("/", () => {
    throw new Error("private filesystem path");
  });
  const request = await serve(t, app);
  assert.deepEqual((await request("/")).json, {
    error: "Internal server error",
  });
});

test("multipart repeats fields, preserves binary bytes and rejects oversized later files before writing", async (t) => {
  const dir = await directory(t);
  const prefix =
    '--b\r\nContent-Disposition: form-data; name="tag"\r\n\r\nnode\r\n--b\r\nContent-Disposition: form-data; name="tag"\r\n\r\nhttp\r\n--b\r\nContent-Disposition: form-data; name="file"; filename="x.bin"\r\n\r\n';
  const binary = Buffer.from([0, 255, 1, 2]);
  const req = input("multipart/form-data; boundary=b");
  const parsed = parseMultipartForm(req, { uploadDir: dir });
  req.end(
    Buffer.concat([Buffer.from(prefix), binary, Buffer.from("\r\n--b--\r\n")])
  );
  const result = await parsed;
  assert.deepEqual(result.fields.tag, ["node", "http"]);
  assert.deepEqual(
    await fs.readFile(path.join(dir, result.files[0].savedAs)),
    binary
  );
  const rejected = input("multipart/form-data; boundary=b");
  const failure = parseMultipartForm(rejected, {
    uploadDir: dir,
    maxFileBytes: 2,
  });
  rejected.end(
    Buffer.concat([Buffer.from(prefix), binary, Buffer.from("\r\n--b--\r\n")])
  );
  await assert.rejects(failure, { statusCode: 413 });
  assert.equal((await fs.readdir(dir)).length, 1);
});

test("multipart rejects malformed and missing boundaries", async (t) => {
  const dir = await directory(t);
  await assert.rejects(
    parseMultipartForm(input("multipart/form-data"), { uploadDir: dir }),
    { statusCode: 400 }
  );
  const req = input("multipart/form-data; boundary=x");
  const pending = parseMultipartForm(req, { uploadDir: dir });
  req.end("broken");
  await assert.rejects(pending, { statusCode: 400 });
});

test("file store serializes multiple instances, rolls back throws and recovers its queue", async (t) => {
  const dir = await directory(t);
  const file = path.join(dir, "data.json");
  const a = createStore(file, { count: 0 });
  const b = createStore(file, { count: 0 });
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? a : b).update(async (data) => {
        await Promise.resolve();
        data.count++;
      })
    )
  );
  assert.equal((await a.read()).count, 20);
  await assert.rejects(
    a.update((data) => {
      data.count = -1;
      throw new Error("rollback");
    }),
    /rollback/
  );
  await b.update((data) => {
    data.count++;
  });
  assert.equal((await a.read()).count, 21);
  assert.deepEqual(await fs.readdir(dir), ["data.json"]);
});

test("file store never resets corrupt JSON", async (t) => {
  const dir = await directory(t);
  const file = path.join(dir, "data.json");
  await fs.writeFile(file, "broken");
  const store = createStore(file, { count: 0 });
  await assert.rejects(store.read(), SyntaxError);
  assert.equal(await fs.readFile(file, "utf8"), "broken");
});

test("original-demo parser adapters delegate to the shared implementations", async () => {
  const { jsonBody } = require("../../../shared/body/jsonBody");
  const req = input("application/json");
  let nextCalls = 0;
  const pending = jsonBody()(req, {}, () => {
    nextCalls++;
  });
  req.end('{"ok":true}');
  await pending;
  assert.equal(nextCalls, 1);
  assert.deepEqual(req.body, { ok: true });
  const { readJsonBody } = require("../../security/file-management/apiCore");
  const original = input("application/json");
  const reading = readJsonBody(original);
  original.end('{"legacy":true}');
  assert.deepEqual(await reading, { legacy: true });
});

test("Range header parser supports closed, open and suffix ranges", () => {
  const { parseRange } = require("../routes-fundamentals/05-http-context");
  assert.deepEqual(parseRange("bytes=2-4", 10), { start: 2, end: 4 });
  assert.deepEqual(parseRange("bytes=8-", 10), { start: 8, end: 9 });
  assert.deepEqual(parseRange("bytes=-3", 10), { start: 7, end: 9 });
  assert.throws(() => parseRange("bytes=10-", 10), {
    statusCode: 416,
    contentRange: "bytes */10",
  });
});

test("shared error middleware normalizes invalid status codes without exposing internals", async (t) => {
  const { errorHandler } = require("../routes-fundamentals/06-middleware");
  const app = mini();
  app.get("/", () => {
    throw Object.assign(new Error("private"), { statusCode: 200 });
  });
  app.use(errorHandler());
  const request = await serve(t, app);
  const response = await request("/");
  assert.equal(response.status, 500);
  assert.deepEqual(response.json, { error: "Internal server error" });
});

test("duplicate registrations fall through in order and next('route') skips only its group", async (t) => {
  const app = mini();
  const trace = [];
  app.get(
    "/",
    (req, res, next) => {
      trace.push("first");
      return next("route");
    },
    () => assert.fail("remaining route handler must be skipped")
  );
  app.use((req, res, next) => {
    trace.push("between");
    return next();
  });
  app.get("/", (req, res, next) => {
    trace.push("second");
    return next();
  });
  app.get("/", (req, res) => res.json(trace));
  const request = await serve(t, app);
  assert.deepEqual((await request("/")).json, ["first", "between", "second"]);
});

test("next('router') exits a mounted router and restores parent state", async (t) => {
  const app = mini();
  const child = mini.Router();
  child.use((req, res, next) => next("router"));
  child.get("/", () => assert.fail("child route must not run"));
  app.use("/api", child);
  app.get("/api", (req, res) =>
    res.json({ path: req.path, baseUrl: req.baseUrl })
  );
  const request = await serve(t, app);
  assert.deepEqual((await request("/api")).json, { path: "/api", baseUrl: "" });
});

test("handler arrays and route chains use the same registration contract", async (t) => {
  const app = mini();
  app.use([
    (req, res, next) => {
      req.value = "ok";
      return next();
    },
  ]);
  app
    .route("/")
    .get([(req, res) => res.send(req.value)])
    .post((req, res) => res.status(201).end());
  const request = await serve(t, app);
  assert.equal((await request("/")).text, "ok");
  assert.equal((await request("/", { method: "POST" })).status, 201);
  assert.throws(() => mini().get("/", []), TypeError);
});

test("URL preparation errors reach registered application error middleware", async (t) => {
  const app = mini();
  const { errorHandler } = require("../routes-fundamentals/06-middleware");
  app.use(errorHandler({ project: "url-boundary" }));
  const request = await serve(t, app);
  const response = await request("/bad%ZZ");
  assert.equal(response.status, 400);
  assert.equal(response.json.project, "url-boundary");
});

test("204 and 304 responses remove representation headers even when json() is used", async (t) => {
  const app = mini();
  app.get("/empty", (req, res) => res.status(204).json({ ignored: true }));
  app.get("/cached", (req, res) => res.status(304).send("ignored"));
  const request = await serve(t, app);
  for (const path of ["/empty", "/cached"]) {
    const response = await request(path);
    assert.equal(response.text, "");
    assert.equal(response.headers["content-length"], undefined);
    assert.equal(response.headers["content-type"], undefined);
  }
});

test("body readers reject a second read instead of waiting for an end event that already happened", async () => {
  const req = input("application/json");
  const first = parseJsonBody(req);
  req.end('{"value":1}');
  await first;
  await assert.rejects(parseJsonBody(req), /already consumed/);
});

test("a disconnect followed by an error event cannot escape the body parser", async () => {
  const req = input("application/json");
  const pending = parseJsonBody(req);
  req.emit("aborted");
  assert.doesNotThrow(() => req.emit("error", new Error("socket reset")));
  req.emit("close");
  await assert.rejects(pending, { statusCode: 400 });
});

test("parser factories reject invalid byte/part limits when registered", () => {
  const { json, urlencoded } = require("../routes-fundamentals/03-body-parser");
  const { multipart } = require("../routes-fundamentals/04-upload-parser");
  assert.throws(() => json({ limit: 0 }), RangeError);
  assert.throws(() => urlencoded({ limit: Infinity }), RangeError);
  assert.throws(
    () => multipart({ uploadDir: "/tmp/unused", maxParts: -1 }),
    RangeError
  );
});

test("multipart accepts empty forms and preserves boundary-like bytes inside file content", async (t) => {
  const dir = await directory(t);
  const empty = input("multipart/form-data; boundary=b");
  const parsedEmpty = parseMultipartForm(empty, { uploadDir: dir });
  empty.end("--b--\r\n");
  assert.equal((await parsedEmpty).files.length, 0);
  const content = Buffer.from("first\r\n--bX\r\n--b--not-a-delimiter\r\nlast");
  const req = input("multipart/form-data; boundary=b");
  const pending = parseMultipartForm(req, { uploadDir: dir });
  req.end(
    Buffer.concat([
      Buffer.from(
        '--b\r\nContent-Disposition: form-data; name="file"; filename="x.bin"\r\n\r\n'
      ),
      content,
      Buffer.from("\r\n--b--\r\n"),
    ])
  );
  const result = await pending;
  assert.deepEqual(
    await fs.readFile(path.join(dir, result.files[0].savedAs)),
    content
  );
});

test("single-value query validation rejects repeated search text", () => {
  const {
    parseFileSearchQuery,
  } = require("../routes-fundamentals/02-query-parser");
  assert.throws(
    () => parseFileSearchQuery(parseQuery(new URLSearchParams("q=one&q=two"))),
    { statusCode: 400 }
  );
});

test("raw upload streaming persists bytes and returns 413 without leaving a partial file", async (t) => {
  const dir = await directory(t);
  const {
    saveRequestFile,
  } = require("../routes-fundamentals/04-upload-parser");
  const app = mini();
  app.post("/upload", async (req, res) => {
    const bytes = await saveRequestFile(req, path.join(dir, "file.bin"), {
      limitBytes: 5,
    });
    res.status(201).json({ bytes });
  });
  const request = await serve(t, app);
  assert.equal(
    (await request("/upload", { method: "POST", raw: "too large" })).status,
    413
  );
  await assert.rejects(fs.stat(path.join(dir, "file.bin")), { code: "ENOENT" });
  assert.equal(
    (await request("/upload", { method: "POST", raw: "hello" })).json.bytes,
    5
  );
  assert.equal(await fs.readFile(path.join(dir, "file.bin"), "utf8"), "hello");
});

test("invalid middleware registration does not leave earlier handlers installed", async (t) => {
  const app = mini();
  assert.throws(
    () => app.use((req, res) => res.status(418).end(), null),
    TypeError
  );
  app.get("/", (req, res) => res.send("valid"));
  const request = await serve(t, app);
  assert.equal((await request("/")).text, "valid");
});

test("route middleware can normalize params without later handlers overwriting them", async (t) => {
  const app = mini();
  app.get(
    "/users/:id",
    (req, res, next) => {
      req.params.id = Number(req.params.id);
      return next();
    },
    (req, res) => res.json({ id: req.params.id })
  );
  const request = await serve(t, app);
  assert.deepEqual((await request("/users/42")).json, { id: 42 });
});

test("reference static serving respects prefix boundaries and conditional requests", async (t) => {
  const dir = await directory(t);
  await fs.writeFile(path.join(dir, "hello.txt"), "hello");
  const {
    serveStatic,
    safeJoin,
  } = require("../reference/files/static-server/staticServer");
  const app = mini();
  app.use(async (req, res, next) => {
    if (!(await serveStatic(req, res, { rootDir: dir }))) return next();
  });
  const request = await serve(t, app);
  const first = await request("/static/hello.txt");
  assert.equal(first.status, 200);
  assert.equal(first.text, "hello");
  assert.equal((await request("/staticx/hello.txt")).status, 404);
  assert.equal(
    (
      await request("/static/hello.txt", {
        headers: { "If-None-Match": first.headers.etag },
      })
    ).status,
    304
  );
  assert.throws(() => safeJoin(dir, "/%ZZ"), { statusCode: 400 });
});

test("reference download serving handles complete, range and HEAD responses", async (t) => {
  const dir = await directory(t);
  await fs.writeFile(path.join(dir, "hello.txt"), "hello");
  const {
    streamDownload,
  } = require("../reference/files/downloads/downloadServer");
  const app = mini();
  app.get("/download", (req, res) =>
    streamDownload(req, res, {
      rootDir: dir,
      fileName: "hello.txt",
      headOnly: req.method === "HEAD",
    })
  );
  const request = await serve(t, app);
  assert.equal((await request("/download")).text, "hello");
  const range = await request("/download", { headers: { Range: "bytes=1-3" } });
  assert.equal(range.status, 206);
  assert.equal(range.text, "ell");
  assert.equal(range.headers["content-range"], "bytes 1-3/5");
  assert.equal((await request("/download", { method: "HEAD" })).text, "");
});

test("JSON byte limits are enforced over HTTP without destroying the 413 response", async (t) => {
  const app = mini();
  app.use(mini.json({ limit: 5 }));
  app.post("/", (req, res) => res.json(req.body));
  const request = await serve(t, app);
  assert.equal(
    (await request("/", { method: "POST", body: { long: "value" } })).status,
    413
  );
  assert.equal((await request("/", { method: "POST", body: 123 })).status, 200);
});
