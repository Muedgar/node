const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("../tests/http");
const serverFile = require("node:path").join(__dirname, "server.js");

test("todo CRUD, query filter and persistence across application restart", async (t) => {
  const f = await fixture(t, serverFile);
  const created = await f.request("/todos", {
    method: "POST",
    body: { title: "Learn middleware" },
  });
  assert.equal(created.status, 201);
  const id = created.json.id;
  assert.equal(
    (await f.request(`/todos/${id}`, { method: "PATCH", body: { done: true } }))
      .json.done,
    true
  );
  assert.equal((await f.request("/todos?done=false")).json.length, 0);
  await f.restart();
  assert.equal((await f.request(`/todos/${id}`)).json.done, true);
  assert.equal(
    (await f.request(`/todos/${id}`, { method: "DELETE" })).status,
    204
  );
  assert.equal((await f.request(`/todos/${id}`)).status, 404);
});

test("todo validation, form parsing and repeated query rejection", async (t) => {
  const f = await fixture(t, serverFile);
  assert.equal(
    (await f.request("/todos", { method: "POST", body: { title: " " } }))
      .status,
    422
  );
  assert.equal(
    (
      await f.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        raw: "title=Read+streams",
      })
    ).json.title,
    "Read streams"
  );
  assert.equal((await f.request("/todos?done=true&done=false")).status, 400);
  assert.equal(
    (
      await f.request("/todos", {
        method: "POST",
        raw: "{",
        headers: { "Content-Type": "application/json" },
      })
    ).status,
    400
  );
});

test("concurrent todo writes do not overwrite one another", async (t) => {
  const f = await fixture(t, serverFile);
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      f.request("/todos", { method: "POST", body: { title: `Task ${i}` } })
    )
  );
  assert.ok(results.every((result) => result.status === 201));
  assert.equal((await f.read()).todos.length, 12);
});

test("MVC routes expose method discovery and ignore client-owned identity fields", async (t) => {
  const f = await fixture(t, serverFile);
  const created = await f.request("/todos", {
    method: "POST",
    body: {
      title: "Read the route file",
      id: "client-id",
      done: true,
      internal: "hidden",
    },
  });
  assert.equal(created.status, 201);
  assert.notEqual(created.json.id, "client-id");
  assert.equal(created.json.done, false);
  assert.deepEqual(Object.keys(created.json).sort(), ["done", "id", "title"]);

  const path = `/todos/${created.json.id}`;
  const head = await f.request(path, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.text, "");
  const options = await f.request(path, { method: "OPTIONS" });
  assert.equal(options.status, 204);
  assert.equal(options.headers.allow, "DELETE, GET, HEAD, OPTIONS, PATCH");
  assert.equal(
    (await f.request(path, { method: "PUT", body: {} })).status,
    405
  );
  assert.equal((await f.request("/unknown")).status, 404);
});
