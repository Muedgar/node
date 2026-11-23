# Router: fundamentals once, five projects for practice

Build Express-style syntax on pure Node.js. Request parsing belongs here: query strings, JSON, URL-encoded forms and multipart uploads. Router contains no new authentication or authorization implementation; those belong in Security.

```text
modules/
├── router/
│   ├── routes-fundamentals/   # Ten reusable implementation files
│   ├── 01-todo/
│   ├── 02-notes/
│   ├── 03-reading-list/
│   ├── 04-room-booking/
│   ├── 05-food-store/
│   ├── tests/                 # Shared tests and HTTP fixture
│   └── reference/             # Original HTTP/parser/file lessons
├── sockets/                   # Events, SSE, WebSocket
└── security/                  # Authentication, hardening, secured file API
```

## Start here

Read the [ten fundamentals](routes-fundamentals/README.md). Your known matcher is implemented once in 01-matcher.js. Every project imports the same implementation through the application/router API.

| Project                                   | Main practice                                        | Run                           |
| ----------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| [Todo](01-todo/README.md)                 | Route chains, body/query parsing, CRUD               | `npm run router:todo`         |
| [Notes](02-notes/README.md)               | Mounted router, search, multipart attachments        | `npm run router:notes`        |
| [Reading list](03-reading-list/README.md) | Nested routers, scoped middleware, state transitions | `npm run router:reading-list` |
| [Room booking](04-room-booking/README.md) | Interval invariants and competing writes             | `npm run router:room-booking` |
| [Food store](05-food-store/README.md)     | Stock transactions and retry-safe orders             | `npm run router:food-store`   |

Requires Node.js 20+; no framework or external dependencies. Every project has a standalone server.js, routes/, controllers/, models/, views/, server.test.js and README.md. Each data.json persists across restarts; Notes also stores attachment bytes. Project tests spawn standalone Node servers with temporary stores and restart real processes to check persistence.

```sh
npm run router:fundamentals:test
npm run router:test
```

## Learning method

1. Learn an unfamiliar fundamental once. Skip rebuilding match() if you already own it.
2. Read a project's route contracts and run its curl examples.
3. Trace server -> routes -> controller -> model transaction -> JSON view -> response.
4. Reproduce the small project while importing the fundamentals.
5. Complete its challenge; add regression tests for your changes.
6. Explain the invariant, a failure case and a tradeoff without looking at the code.

Practice recall and understanding together: rebuild a route flow, explain the purpose of each function, then diagnose a failing request without looking at the reference implementation.

## Original lessons

Existing material and stored files were moved into reference/, Sockets and Security rather than discarded. Legacy module:01 through module:14 npm commands point to their new locations. Body, query and multipart reference demos import the shared fundamental parsers. The secured file-management demo lives in Security and imports those parsers too.

The previous seven snapshot folders were replaced by the shared-fundamentals approach. The new router API is Express-shaped with documented differences, including your original static scoring, literal mount prefixes and automatic method discovery.

## MVC architecture in every project

The server reads like an Express application, while every framework capability is implemented in routes-fundamentals using Node core. It imports route modules, mounts them with app.use(), installs shared error middleware, then calls app.listen(). It never exports a server or application factory.

Routes declare URLs and middleware. Controllers translate HTTP input into model calls and choose status codes. Models own business invariants and durable updates without receiving req or res. Views explicitly select public JSON fields, so file schemas and response schemas can evolve independently. Tests launch standalone processes and verify the complete path, including restart persistence.

Reusable matching, parsing, dispatch, error handling and validation functions belong in Fundamentals. Resource-specific rules such as booking overlaps or order retry identity belong in the relevant model. Keeping those rules near their transaction makes the consistency boundary visible.

## Review results

The existing MVC boundaries and queued file commits were useful foundations. The review retained them and fixed these concrete gaps:

| Finding                                                                     | Fix                                                                                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A second body reader could wait forever                                     | [03-body-parser.js](routes-fundamentals/03-body-parser.js) rejects repeated reads and uses Node’s iterator for stream lifecycle handling.                         |
| Duplicate routes could not fall through; parameter changes were overwritten | [06-middleware.js](routes-fundamentals/06-middleware.js) and [07-router.js](routes-fundamentals/07-router.js) preserve per-route state and explicit continuation. |
| Invalid URLs bypassed application error middleware                          | [08-application.js](routes-fundamentals/08-application.js) dispatches boundary errors through error middleware.                                                   |
| 204/304 helpers could retain misleading body headers                        | [05-http-context.js](routes-fundamentals/05-http-context.js) removes representation headers for empty-status responses.                                           |
| Multipart prefixes inside file content could be mistaken for delimiters     | [04-upload-parser.js](routes-fundamentals/04-upload-parser.js) checks complete delimiters and validates every part before writing.                                |
| Raw upload limits could close the socket before 413 or retain partial files | The shared raw-file writer awaits writes, preserves the response socket, and removes failed uploads.                                                              |
| Models depended on route middleware for string validation                   | [10-validation.js](routes-fundamentals/10-validation.js) supplies validation usable from both models and routes.                                                  |
| A static prefix also matched /staticx                                       | The reference static server now checks path-segment boundaries.                                                                                                   |

Review assessment: **correctness — covered for the documented API; maintainability — improved with named steps and purpose comments; performance — bounded for small single-process projects; security — authentication/authorization review excluded as requested.** Route matching is still linear, and JSON transactions rewrite a complete small file. The matcher was excluded from refactoring, so its documented matching policies remain in force.
