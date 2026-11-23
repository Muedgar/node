# Request and routing fundamentals — ten reusable files

Body parsing is a request fundamental. JSON, HTML forms, multipart uploads and query parsing belong here, alongside matching and dispatch. Authentication, sessions, passwords and authorization belong in `modules/security`.

These files are implemented with Node core only. The five sibling projects import them directly; projects never copy the matcher or parser implementations. Numbers suggest reading order, not isolated versions to rebuild repeatedly. You already know the matcher: skim its contract, then spend your effort on unfamiliar concepts.

## Read for recall

The matcher is unchanged; skip file 1. For each remaining file, start with its public function, read the problem comment, and trace one input through the named helpers. Remember the algorithm before memorizing syntax.

| File             | Algorithm to reconstruct from memory                                  | A question that checks understanding                           |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| 02 — Query       | preserve repetitions -> require one value -> convert/validate         | Why is Boolean("false") incorrect here?                        |
| 03 — Body        | iterate chunks -> count bytes -> collect -> decode                    | Why must a size rejection leave the socket open?               |
| 04 — Upload      | read -> split -> validate all parts -> save -> roll back failures     | Why validate later parts before writing earlier files?         |
| 05 — Context     | prepare request -> decorate response -> serialize -> write bytes      | Why does string length differ from Content-Length?             |
| 06 — Middleware  | choose normal/error handler -> call once -> continue or stop          | What changes between next(), next(error), and next("route")?   |
| 07 — Router      | register -> select -> collect layers -> run pipeline                  | What state must a mounted router restore?                      |
| 08 — Application | create HTTP server -> prepare -> dispatch -> final fallback           | Why must a child router return control instead of sending 404? |
| 09 — Store       | queue -> load private snapshot -> change -> write temporary -> rename | How does a thrown validation error roll back?                  |
| 10 — Validation  | check contract -> throw expected error or continue                    | Why must a model validate direct calls too?                    |

The comments above functions explain the problem, not each JavaScript statement. Multipart parsing has more helpers because byte boundaries, part headers, validation, disk writes and rollback solve different problems. Learn those helpers one at a time.

## The ten files

| File                                       | Responsibility                 | What to know                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-matcher.js](01-matcher.js)             | Route selection                | Your existing match(method, pathname), static/dynamic scoring, decoded params, 404 vs 405. Read once; reuse everywhere.                                                                              |
| [02-query-parser.js](02-query-parser.js)   | Query strings                  | parseQuery produces strings or arrays. Typed helpers validate booleans, enums, positive integers and canonical UTC intervals explicitly.                                                             |
| [03-body-parser.js](03-body-parser.js)     | One-shot request streams       | readBody limits bytes; parseJsonBody returns body/raw/bytes/empty; readBody uses Node’s stream iterator; json and urlencoded expose middleware factories.                                            |
| [04-upload-parser.js](04-upload-parser.js) | Multipart form bodies          | Read bounded binary buffers, separate headers/content by boundaries, parse repeated fields, write files and expose req.files.                                                                        |
| [05-http-context.js](05-http-context.js)   | HTTP request/response boundary | Parse relative URLs with a fixed base; expose path, params, query, get, locals, status, json and send on Node objects; parse Range headers for downloads.                                            |
| [06-middleware.js](06-middleware.js)       | Execution flow                 | runPipeline walks layers, awaits promises, implements next(error), skips error/normal layers and detects duplicate next calls. setResponseHeader and errorHandler are reusable middleware factories. |
| [07-router.js](07-router.js)               | Composition                    | Register multiple handlers, use literal prefixes, mount nested Router objects, restore request state, chain route(path).get().patch().                                                               |
| [08-application.js](08-application.js)     | Server integration             | express(), express.Router(), express.json(), express.urlencoded(), express.multipart(), app.createServer() and app.listen() bridge to node:http.                                                     |
| [09-file-store.js](09-file-store.js)       | Persistent consistency         | Read JSON from disk; serialize updates per path; rename temporary snapshots; reject corrupt state without replacing it.                                                                              |
| [10-validation.js](10-validation.js)       | Contracts                      | requireFields provides route middleware; assertInput, findById, httpError and getErrorStatus keep validation and error contracts consistent.                                                         |

## The syntax you will practice

```js
const express = require("./08-application");
const { requireFields } = require("./10-validation");
const app = express();
const todos = express.Router();

app.use(express.json({ limit: 10_000 }));
app.use(express.urlencoded());
todos
  .route("/")
  .get((req, res) => res.json({ query: req.query }))
  .post(requireFields("title"), (req, res) => {
    res.status(201).json({ title: req.body.title });
  });
app.use("/todos", todos);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.statusCode || 500).json({ error: "Request failed" });
});
app.listen(3500, "127.0.0.1");
```

Run that example from this directory if you save it elsewhere. The projects show persistence and actual resource operations.

## Request flow

```text
node:http
  -> decorate the real IncomingMessage / ServerResponse
  -> parse URL and query (the body is still a stream)
  -> matcher chooses a route within this router invocation
  -> registered middleware, including the relevant body parser
  -> selected route's middleware and handler(s)
       -> read/update a file store, then respond
       -> OR pass an error to error middleware
  -> fallback: 404, 405 + Allow, or automatic OPTIONS
```

A mounted router repeats selection with a child-relative `req.path`. `req.originalUrl` and `req.url` stay original. `req.baseUrl` records literal mount prefixes. Parent state is restored before parent fallthrough or error handling.

## Contracts worth remembering

- `next()` continues; sending a response can stop the pipeline. Returning arbitrary data does not respond. A handler that does neither can hang.
- Async middleware should `return next()` or `await next()` when downstream completion matters. Detached timers must handle their own errors.
- `next("route")` skips the remaining handlers in the current registration; `next("router")` returns control to the parent. The matcher still selects one highest-scoring path pattern, so lower-priority alternative patterns are not retried.
- Error middleware keeps all four arguments `(error, req, res, next)`. `next()` clears the current error; `next(error)` keeps propagating it.
- Register middleware before affected routes, and error middleware after them. Selection happens once per router invocation; path rewriting does not restart it.
- Body streams are consumed once; a second reader receives 400 instead of hanging. JSON, URL-encoded and multipart middleware check the media type and skip other types. `req.body` starts undefined; empty JSON becomes null. Field validators reject missing/invalid objects.
- Multipart middleware exposes text fields as `req.body` and file metadata as `req.files`. It buffers a bounded body; large-file streaming is a separate exercise. saveRequestFile() streams raw uploads with disk-write backpressure and removes partial files on failure. Its buffered multipart grammar uses quoted name/filename fields and has no nested multipart or filename\* support.
- The matcher keeps your original total-score precedence: static segment 10, parameter 1; registration order breaks ties. Trailing/repeated slashes are ignored. Duplicate registrations for the selected method/path run in registration order when earlier handlers call next(). Multiple handlers can also be supplied in one registration.
- Mount prefixes are literal, not parameter patterns. HEAD falls back to GET; explicit HEAD/OPTIONS handlers take priority. OPTIONS is method discovery, not a CORS policy.
- `fileStore.update(callback)` loads a private snapshot, applies changes and writes only if the callback succeeds. Return a result from the callback, not an HTTP response; respond after the commit finishes.
- File updates are serialized within one process by absolute filename. Rename prevents readers seeing half-written JSON. This is not a multi-process database, a multi-file transaction, or an fsync durability guarantee. Keep files small.
- Incoming-request timeouts do not implement handler execution deadlines. This is an educational API with deliberate policies, not full Express compatibility.

## Exercises by file

- **01-matcher.js:** Add one static/dynamic ambiguity test; explain the tie policy.
- **02-query-parser.js:** Reject repeated page values and add an upper pagination limit.
- **03-body-parser.js:** Explain why calling two body readers on the same stream can hang; test an abort and a byte limit.
- **04-upload-parser.js:** Test a binary attachment and a too-large later part; prove rejected validation writes no files.
- **05-http-context.js:** Explain headersSent vs writableEnded; test Unicode Content-Length and HEAD.
- **06-middleware.js:** Predict before/after order with await next(); demonstrate early termination.
- **07-router.js:** Prove parent state is restored before fallthrough; test 405 through two mounted routers.
- **08-application.js:** Write a six-line app from memory; trace an async error to its final HTTP response.
- **09-file-store.js:** Race two updates, throw midway through a transaction and show the next transaction still succeeds.
- **10-validation.js:** Choose between 400, 404, 409 and 422 for concrete requests; add a domain validator.

## Verify

From the repository root:

```sh
npm run router:fundamentals:test
npm run router:test
```

Tests use temporary directories and ephemeral loopback ports. Project tests launch the standalone scripts as child processes; project files export nothing. They never modify a project's default data.json or attachment directory.

Practice memory and understanding together: reconstruct the algorithm, explain why each step exists, then use a failing test to diagnose an unfamiliar input.

## Where new functions belong

Generic parsing, routing, error handling, upload cleanup and validation helpers stay in these ten files. Models import them instead of copying them. Domain functions such as reserve(), advance() and place() live in project models because their invariants are specific to that project.

Each project's routes/ file uses express.Router(), router.get(), router.post() or router.route(). Controllers use the real Node request/response objects decorated by the application layer. No Express package is installed.

## Review scope and evidence

Files 2–10 and all five MVC projects were reviewed. File 1 was deliberately left unchanged because you already know it. Security and Sockets were not changed.

The regression suite covers duplicate-route continuation, next("route"), next("router"), parameter normalization, handler arrays, malformed URLs, body re-reading, aborts, byte limits, binary boundaries, raw upload rollback, empty status responses, file-store transactions, direct model validation, and the five project workflows. The original download/static examples are also exercised through HTTP.
