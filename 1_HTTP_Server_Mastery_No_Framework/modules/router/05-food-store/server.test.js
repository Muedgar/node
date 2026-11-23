const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("../tests/http");
const serverFile = require("node:path").join(__dirname, "server.js");
const order = (key, items) => ({
  method: "POST",
  headers: { "Idempotency-Key": key },
  body: { items },
});

test("trusted prices, idempotent replay across restart, and one-time restock", async (t) => {
  const f = await fixture(t, serverFile);
  const options = order("first", [{ productId: "rice", quantity: 2 }]);
  const created = await f.request("/api/orders", options);
  assert.equal(created.status, 201);
  assert.equal(created.json.totalCents, 1000);
  await f.restart();
  const replay = await f.request("/api/orders", options);
  assert.equal(replay.status, 200);
  assert.equal(replay.json.id, created.json.id);
  assert.equal((await f.read()).products[0].stock, 3);
  assert.equal(
    (
      await f.request(
        "/api/orders",
        order("first", [{ productId: "rice", quantity: 1 }])
      )
    ).status,
    409
  );
  const cancel = `/api/orders/${created.json.id}/cancel`;
  assert.equal(
    (await f.request(cancel, { method: "POST" })).json.status,
    "cancelled"
  );
  await f.request(cancel, { method: "POST" });
  assert.equal((await f.read()).products[0].stock, 5);
});

test("competing orders cannot oversell stock", async (t) => {
  const f = await fixture(t, serverFile);
  const results = await Promise.all(
    ["a", "b"].map((key) =>
      f.request("/api/orders", order(key, [{ productId: "rice", quantity: 4 }]))
    )
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await f.read()).products[0].stock, 1);
  assert.equal((await f.read()).orders.length, 1);
});

test("failure on later item rolls back earlier stock changes", async (t) => {
  const f = await fixture(t, serverFile);
  const failed = await f.request(
    "/api/orders",
    order("rollback", [
      { productId: "beans", quantity: 1 },
      { productId: "rice", quantity: 99 },
    ])
  );
  assert.equal(failed.status, 409);
  assert.equal(failed.json.project, "food-store");
  const data = await f.read();
  assert.equal(data.products[1].stock, 3);
  assert.equal(data.orders.length, 0);
});

test("duplicate item lines are aggregated and canonicalized for replay", async (t) => {
  const f = await fixture(t, serverFile);
  const first = await f.request(
    "/api/orders",
    order("same", [
      { productId: "rice", quantity: 1 },
      { productId: "rice", quantity: 1 },
    ])
  );
  assert.equal(first.json.items.length, 1);
  assert.equal(
    (
      await f.request(
        "/api/orders",
        order("same", [{ productId: "rice", quantity: 2 }])
      )
    ).status,
    200
  );
  assert.equal(
    (await f.request("/api/orders", { method: "POST", body: { items: [] } }))
      .status,
    422
  );
});

test("JSON views expose price snapshots while keeping retry bookkeeping in the model", async (t) => {
  const f = await fixture(t, serverFile);
  const created = await f.request(
    "/api/orders",
    order("public-view", [{ productId: "beans", quantity: 2 }])
  );
  assert.equal(created.status, 201);
  assert.deepEqual(created.json.items, [
    { productId: "beans", quantity: 2, unitPriceCents: 300 },
  ]);
  assert.equal(created.json.totalCents, 600);
  assert.equal("key" in created.json, false);
  assert.equal("fingerprint" in created.json, false);
  const stored = (await f.read()).orders[0];
  assert.equal(stored.key, "public-view");
  assert.equal(typeof stored.fingerprint, "string");
  assert.deepEqual(
    (await f.request(`/api/orders/${created.json.id}`)).json,
    created.json
  );
});
