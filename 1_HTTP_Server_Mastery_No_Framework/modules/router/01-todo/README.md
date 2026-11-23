# 01 — Todo API

Basic method helpers, route chaining, JSON/form body middleware, params, strict query conversion and file-backed CRUD.

This is a standalone server: it imports the shared fundamentals, creates app, mounts its route modules, installs error middleware, then calls app.listen(). It exports nothing. Tests launch it as a child process.

This project imports the shared fundamentals. Read its server.js as a composition exercise; you do not need to rebuild the matcher. It contains no authentication, sessions or authorization. Those are taught separately under Security.

## MVC code map

```text
server.js                      # Standalone composition and app.listen(); no exports
routes/todoRoutes.js           # Express Router declarations and route middleware
controllers/todoController.js  # HTTP input -> model -> JSON response
models/todoModel.js            # Domain rules and file transactions; no req/res
views/todoView.js              # Explicit public JSON representation
server.test.js                 # Starts a real process and exercises HTTP contracts
```

The API's views are JSON serializers. They define the response shape independently of stored records; there is no HTML template engine. Each layer has a concrete responsibility rather than passing the whole request into persistence.

Read the files in this order: **server -> routes -> controller -> model -> view**. For one request, follow the named controller function to the model operation, then back to the view and response. Route modules export routers and domain modules export functions; the standalone server exports nothing.

## Run

```sh
# From the repository root:
npm run router:todo
npm run router:todo:test
```

The server listens at http://127.0.0.1:3401. Set PORT to change it. State lives in this folder's data.json, created on the first store operation. Stop and restart the process to verify persistence. Set DATA_FILE to an absolute path to use another database. Run one process per file; tests use isolated temporary files.

## Routes

| Method | Path                | Behavior                                     |
| ------ | ------------------- | -------------------------------------------- |
| GET    | `/todos?done=false` | List/filter todos                            |
| POST   | `/todos`            | Create from title (JSON or URL-encoded form) |
| GET    | `/todos/:id`        | Read one                                     |
| PATCH  | `/todos/:id`        | Set boolean done                             |
| DELETE | `/todos/:id`        | Delete; 204                                  |

## Try it

```sh
curl -i -X POST http://127.0.0.1:3401/todos \
  -H 'Content-Type: application/json' \
  --data '{"title":"Learn middleware"}'
```

Use the returned id:

```sh
curl -i -X PATCH http://127.0.0.1:3401/todos/ID \
  -H 'Content-Type: application/json' --data '{"done":true}'
curl -i 'http://127.0.0.1:3401/todos?done=true'
```

## Invariants

Concurrent creations must all survive. Invalid done query values return 400; invalid body fields return 422. Deleting a missing todo returns 404.

## Independent challenge

1. Trace a form request: why does JSON middleware skip it?
2. Add a title update without allowing clients to replace id.
3. Add pagination using parsePositiveInteger; reject repeated and oversized values.

Reproduce the MVC request flow from the route contract while importing the fundamentals. Keep HTTP concerns in controllers and consistency checks inside model transactions. Add one meaningful regression test for each feature you add. Explain one alternative design and why you chose yours. Practice both recall and understanding: explain the purpose of each function and predict failure behavior before running its test.
