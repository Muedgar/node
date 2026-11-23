# 04 — Room booking

Route params, UTC timestamp validation, half-open intervals and concurrency-safe business invariants.

This is a standalone server: it imports the shared fundamentals, creates app, mounts its route modules, installs error middleware, then calls app.listen(). It exports nothing. Tests launch it as a child process.

This project imports the shared fundamentals. Read its server.js as a composition exercise; you do not need to rebuild the matcher. It contains no authentication, sessions or authorization. Those are taught separately under Security.

## MVC code map

```text
server.js                         # Standalone composition and app.listen(); no exports
routes/bookingRoutes.js           # Express Router declarations and route middleware
controllers/bookingController.js  # HTTP input -> model -> JSON response
models/bookingModel.js            # Domain rules and file transactions; no req/res
views/bookingView.js              # Explicit public JSON representation
server.test.js                    # Starts a real process and exercises HTTP contracts
```

The API's views are JSON serializers. They define the response shape independently of stored records; there is no HTML template engine. Each layer has a concrete responsibility rather than passing the whole request into persistence.

Read the files in this order: **server -> routes -> controller -> model -> view**. For one request, follow the named controller function to the model operation, then back to the view and response. Route modules export routers and domain modules export functions; the standalone server exports nothing.

## Run

```sh
# From the repository root:
npm run router:room-booking
npm run router:room-booking:test
```

The server listens at http://127.0.0.1:3404. Set PORT to change it. State lives in this folder's data.json, created on the first store operation. Stop and restart the process to verify persistence. Set DATA_FILE to an absolute path to use another database. Run one process per file; tests use isolated temporary files.

## Routes

| Method | Path                          | Behavior                                  |
| ------ | ----------------------------- | ----------------------------------------- |
| GET    | `/api/rooms`                  | Seeded rooms blue and green               |
| GET    | `/api/bookings`               | List bookings, including cancelled ones   |
| POST   | `/api/rooms/:roomId/bookings` | Reserve UTC start/end interval            |
| DELETE | `/api/bookings/:id`           | Cancel; repeated cancellation is harmless |

## Try it

```sh
curl -i -X POST http://127.0.0.1:3404/api/rooms/blue/bookings \
  -H 'Content-Type: application/json' \
  --data '{"start":"2027-01-01T10:00:00Z","end":"2027-01-01T11:00:00Z"}'
```

## Invariants

Intervals are [start,end): one booking may start when another ends. Cancelled bookings do not block availability. No future-date restriction is imposed. Two concurrent overlapping requests in one process must produce exactly one 201 and one 409.

## Independent challenge

1. Explain overlap: start < existing.end && end > existing.start.
2. Add a room capacity invariant inside the same transaction.
3. Add a reschedule endpoint; exclude its own booking while checking collisions.

Reproduce the MVC request flow from the route contract while importing the fundamentals. Keep HTTP concerns in controllers and consistency checks inside model transactions. Add one meaningful regression test for each feature you add. Explain one alternative design and why you chose yours. Practice both recall and understanding: explain the purpose of each function and predict failure behavior before running its test.
