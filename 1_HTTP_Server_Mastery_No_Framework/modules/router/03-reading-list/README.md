# 03 — Reading list

Nested routers, scoped middleware and domain state transitions enforced inside file transactions.

This is a standalone server: it imports the shared fundamentals, creates app, mounts its route modules, installs error middleware, then calls app.listen(). It exports nothing. Tests launch it as a child process.

This project imports the shared fundamentals. Read its server.js as a composition exercise; you do not need to rebuild the matcher. It contains no authentication, sessions or authorization. Those are taught separately under Security.

## MVC code map

```text
server.js                      # Standalone composition and app.listen(); no exports
routes/bookRoutes.js           # Express Router declarations and route middleware
controllers/bookController.js  # HTTP input -> model -> JSON response
models/bookModel.js            # Domain rules and file transactions; no req/res
views/bookView.js              # Explicit public JSON representation
server.test.js                 # Starts a real process and exercises HTTP contracts
```

routes/apiRoutes.js supplies scoped middleware and mounts bookRoutes beneath /books.

The API's views are JSON serializers. They define the response shape independently of stored records; there is no HTML template engine. Each layer has a concrete responsibility rather than passing the whole request into persistence.

Read the files in this order: **server -> routes -> controller -> model -> view**. For one request, follow the named controller function to the model operation, then back to the view and response. Route modules export routers and domain modules export functions; the standalone server exports nothing.

## Run

```sh
# From the repository root:
npm run router:reading-list
npm run router:reading-list:test
```

The server listens at http://127.0.0.1:3403. Set PORT to change it. State lives in this folder's data.json, created on the first store operation. Stop and restart the process to verify persistence. Set DATA_FILE to an absolute path to use another database. Run one process per file; tests use isolated temporary files.

## Routes

| Method | Path                        | Behavior                               |
| ------ | --------------------------- | -------------------------------------- |
| GET    | `/api/books?status=reading` | Filter by planned, reading or finished |
| POST   | `/api/books`                | Create title; initial status planned   |
| GET    | `/api/books/:id`            | Read one                               |
| PATCH  | `/api/books/:id`            | Advance status exactly one step        |

## Try it

```sh
curl -i -X POST http://127.0.0.1:3403/api/books \
  -H 'Content-Type: application/json' \
  --data '{"title":"Node internals"}'
```

Replace ID with the returned book id:

```sh
curl -i -X PATCH http://127.0.0.1:3403/api/books/ID \
  -H 'Content-Type: application/json' --data '{"status":"reading"}'
curl -i 'http://127.0.0.1:3403/api/books?status=reading'
```

## Invariants

Only planned -> reading -> finished is permitted. State changes and their checks happen in one update. /api scoped middleware sets X-API-Version: 1; books are nested below it.

## Independent challenge

1. Draw planned -> reading -> finished; identify every rejected transition.
2. Add a reread operation with an explicit transition rule and regression tests.
3. Explain the difference between a malformed status (422) and a forbidden transition (409).

Reproduce the MVC request flow from the route contract while importing the fundamentals. Keep HTTP concerns in controllers and consistency checks inside model transactions. Add one meaningful regression test for each feature you add. Explain one alternative design and why you chose yours. Practice both recall and understanding: explain the purpose of each function and predict failure behavior before running its test.
