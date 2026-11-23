const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("../tests/http");
const serverFile = require("node:path").join(__dirname, "server.js");

test("reading-list state machine, nested routers and persistence", async (t) => {
  const f = await fixture(t, serverFile);
  const book = await f.request("/api/books", {
    method: "POST",
    body: { title: "Node internals" },
  });
  assert.equal(book.status, 201);
  assert.equal(book.headers["x-api-version"], "1");
  const route = `/api/books/${book.json.id}`;
  assert.equal(
    (await f.request(route, { method: "PATCH", body: { status: "finished" } }))
      .status,
    409
  );
  assert.equal(
    (await f.request(route, { method: "PATCH", body: { status: "reading" } }))
      .status,
    200
  );
  assert.equal((await f.request("/api/books?status=reading")).json.length, 1);
  assert.equal(
    (await f.request(route, { method: "PATCH", body: { status: "finished" } }))
      .status,
    200
  );
  await f.restart();
  assert.equal((await f.request(route)).json.status, "finished");
  assert.equal(
    (await f.request(route, { method: "PATCH", body: { status: "reading" } }))
      .status,
    409
  );
});

test("reading-list rejects invalid states and reports child method mismatch", async (t) => {
  const f = await fixture(t, serverFile);
  assert.equal((await f.request("/api/books?status=unknown")).status, 400);
  const wrong = await f.request("/api/books/missing", { method: "POST" });
  assert.equal(wrong.status, 405);
  assert.ok(wrong.headers.allow.includes("PATCH"));
});
