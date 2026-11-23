# 02 — Notes and attachments

Mounted routers, search queries, unique-resource conflicts and multipart text/binary parsing with persistent metadata.

This is a standalone server: it imports the shared fundamentals, creates app, mounts its route modules, installs error middleware, then calls app.listen(). It exports nothing. Tests launch it as a child process.

This project imports the shared fundamentals. Read its server.js as a composition exercise; you do not need to rebuild the matcher. It contains no authentication, sessions or authorization. Those are taught separately under Security.

## MVC code map

```text
server.js                      # Standalone composition and app.listen(); no exports
routes/noteRoutes.js           # Express Router declarations and route middleware
controllers/noteController.js  # HTTP input -> model -> JSON response
models/noteModel.js            # Domain rules and file transactions; no req/res
views/noteView.js              # Explicit public JSON representation
server.test.js                 # Starts a real process and exercises HTTP contracts
```

config.js shares the data and attachment paths between upload middleware and the model.

The API's views are JSON serializers. They define the response shape independently of stored records; there is no HTML template engine. Each layer has a concrete responsibility rather than passing the whole request into persistence.

Read the files in this order: **server -> routes -> controller -> model -> view**. For one request, follow the named controller function to the model operation, then back to the view and response. Route modules export routers and domain modules export functions; the standalone server exports nothing.

## Run

```sh
# From the repository root:
npm run router:notes
npm run router:notes:test
```

The server listens at http://127.0.0.1:3402. Set PORT to change it. State lives in this folder's data.json, created on the first store operation. Stop and restart the process to verify persistence. Set DATA_FILE to an absolute path to use another database. Run one process per file; tests use isolated temporary files.

## Routes

| Method | Path                         | Behavior                                                  |
| ------ | ---------------------------- | --------------------------------------------------------- |
| GET    | `/api/notes?q=streams`       | Search title and text                                     |
| POST   | `/api/notes`                 | Create with title and text; unique case-insensitive title |
| GET    | `/api/notes/:id`             | Read note and attachments                                 |
| PATCH  | `/api/notes/:id`             | Replace text                                              |
| POST   | `/api/notes/:id/attachments` | Upload multipart files                                    |

## Try it

```sh
curl -i -X POST http://127.0.0.1:3402/api/notes \
  -H 'Content-Type: application/json' \
  --data '{"title":"Streams","text":"Backpressure notes"}'
```

Replace ID with the returned note id:

```sh
curl -i http://127.0.0.1:3402/api/notes/ID/attachments \
  -F 'tag=node' -F 'file=@README.md'
```

Each file is limited to 10000 bytes, the complete multipart body to 30000 bytes. File bytes persist under attachments/; GET note returns metadata.

## Invariants

An upload first checks that the note exists. Files are saved under attachments/ and metadata in data.json. JSON commit errors trigger best-effort file cleanup. A process crash between the file write and metadata commit can still leave an orphan: this is a two-resource consistency problem.

## Independent challenge

1. Explain why duplicate-title checking belongs inside store.update().
2. Add attachment download using a saved filename found through note metadata.
3. Design attachment deletion; discuss the failure between JSON commit and unlink.

Reproduce the MVC request flow from the route contract while importing the fundamentals. Keep HTTP concerns in controllers and consistency checks inside model transactions. Add one meaningful regression test for each feature you add. Explain one alternative design and why you chose yours. Practice both recall and understanding: explain the purpose of each function and predict failure behavior before running its test.
