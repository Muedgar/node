# 05 — Food store

Composed routers, transaction rollback, trusted integer pricing, stock consistency and persistent idempotency.

This is a standalone server: it imports the shared fundamentals, creates app, mounts its route modules, installs error middleware, then calls app.listen(). It exports nothing. Tests launch it as a child process.

This project imports the shared fundamentals. Read its server.js as a composition exercise; you do not need to rebuild the matcher. It contains no authentication, sessions or authorization. Those are taught separately under Security.

## MVC code map

```text
server.js                       # Standalone composition and app.listen(); no exports
routes/orderRoutes.js           # Express Router declarations and route middleware
controllers/orderController.js  # HTTP input -> model -> JSON response
models/orderModel.js            # Domain rules and file transactions; no req/res
views/orderView.js              # Explicit public JSON representation
server.test.js                  # Starts a real process and exercises HTTP contracts
```

The API's views are JSON serializers. They define the response shape independently of stored records; there is no HTML template engine. Each layer has a concrete responsibility rather than passing the whole request into persistence.

Read the files in this order: **server -> routes -> controller -> model -> view**. For one request, follow the named controller function to the model operation, then back to the view and response. Route modules export routers and domain modules export functions; the standalone server exports nothing.

## Run

```sh
# From the repository root:
npm run router:food-store
npm run router:food-store:test
```

The server listens at http://127.0.0.1:3405. Set PORT to change it. State lives in this folder's data.json, created on the first store operation. Stop and restart the process to verify persistence. Set DATA_FILE to an absolute path to use another database. Run one process per file; tests use isolated temporary files.

## Routes

| Method | Path                     | Behavior                                                     |
| ------ | ------------------------ | ------------------------------------------------------------ |
| GET    | `/api/products`          | Seeded rice (500 cents, stock 5), beans (300 cents, stock 3) |
| POST   | `/api/orders`            | Place items; Idempotency-Key required                        |
| GET    | `/api/orders/:id`        | Read order                                                   |
| POST   | `/api/orders/:id/cancel` | Cancel and restock exactly once                              |

## Try it

```sh
curl -i -X POST http://127.0.0.1:3405/api/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: first-order' \
  --data '{"items":[{"productId":"rice","quantity":2}]}'
```

Repeat the exact request: expect 200 and the same order ID. Change quantity with the same key: expect 409. Use a fresh key for a new order.

## Invariants

Prices come from stored products, never the request. Duplicate product lines are combined and sorted before fingerprinting. A fresh key returns 201; an identical replay returns 200, including after restart. A conflicting replay returns 409. Validation, stock decrement and order creation share one file commit. Cancellation is idempotent; replaying a cancelled order returns its existing cancelled state.

## Independent challenge

1. Explain why checking stock before store.update() is a race.
2. Retry the same key after a restart; verify unchanged stock and order ID.
3. Reject reuse of a key for different items; test failure on a later item.
4. Design idempotency expiry and discuss retry semantics for an already cancelled order.

Reproduce the MVC request flow from the route contract while importing the fundamentals. Keep HTTP concerns in controllers and consistency checks inside model transactions. Add one meaningful regression test for each feature you add. Explain one alternative design and why you chose yours. Practice both recall and understanding: explain the purpose of each function and predict failure behavior before running its test.

The model stores retry keys and fingerprints; orderView omits them from HTTP responses. Each order line includes unitPriceCents so its historical price remains meaningful.
