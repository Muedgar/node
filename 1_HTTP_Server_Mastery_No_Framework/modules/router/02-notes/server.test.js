const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { fixture } = require("../tests/http");
const serverFile = require("node:path").join(__dirname, "server.js");

test("notes mount, case-insensitive uniqueness, search and update survive restart", async (t) => {
  const f = await fixture(t, serverFile);
  const note = await f.request("/api/notes", {
    method: "POST",
    body: { title: "Streams", text: "Backpressure" },
  });
  assert.equal(note.status, 201);
  assert.equal(
    (
      await f.request("/api/notes", {
        method: "POST",
        body: { title: "streams", text: "duplicate" },
      })
    ).status,
    409
  );
  assert.equal((await f.request("/api/notes?q=pressure")).json.length, 1);
  assert.equal(
    (
      await f.request(`/api/notes/${note.json.id}`, {
        method: "PATCH",
        body: { text: "Updated" },
      })
    ).status,
    200
  );
  await f.restart();
  assert.equal(
    (await f.request(`/api/notes/${note.json.id}`)).json.text,
    "Updated"
  );
  assert.equal((await f.request("/api/notesx")).status, 404);
});

test("multipart attachments persist bytes and metadata without exposing client filenames as paths", async (t) => {
  const f = await fixture(t, serverFile);
  const note = (
    await f.request("/api/notes", {
      method: "POST",
      body: { title: "Files", text: "Binary data" },
    })
  ).json;
  const raw =
    '--demo\r\nContent-Disposition: form-data; name="file"; filename="../../hello.txt"\r\nContent-Type: text/plain\r\n\r\nhello world\r\n--demo--\r\n';
  const uploaded = await f.request(`/api/notes/${note.id}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=demo" },
    raw,
  });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.json[0].size, 11);
  assert.equal(
    await fs.readFile(
      path.join(f.directory, "attachments", uploaded.json[0].savedAs),
      "utf8"
    ),
    "hello world"
  );
  await f.restart();
  assert.equal(
    (await f.request(`/api/notes/${note.id}`)).json.attachments.length,
    1
  );
  assert.equal(
    (
      await f.request("/api/notes/missing/attachments", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=demo" },
        raw,
      })
    ).status,
    404
  );
});

test("concurrent duplicate note creation commits one record", async (t) => {
  const f = await fixture(t, serverFile);
  const results = await Promise.all(
    ["Transactions", "transactions"].map((title) =>
      f.request("/api/notes", {
        method: "POST",
        body: { title, text: "One unique title" },
      })
    )
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await f.read()).notes.length, 1);
});

test("oversized uploads leave note metadata and attachments unchanged", async (t) => {
  const f = await fixture(t, serverFile);
  const note = (
    await f.request("/api/notes", {
      method: "POST",
      body: { title: "Small files", text: "Bounded uploads" },
    })
  ).json;
  const raw =
    '--demo\r\nContent-Disposition: form-data; name="file"; filename="large.txt"\r\n\r\n' +
    "x".repeat(10001) +
    "\r\n--demo--\r\n";
  const response = await f.request(`/api/notes/${note.id}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=demo" },
    raw,
  });
  assert.equal(response.status, 413);
  assert.equal((await f.read()).notes[0].attachments.length, 0);
  await assert.rejects(fs.stat(path.join(f.directory, "attachments")), {
    code: "ENOENT",
  });
});
