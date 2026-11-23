const test = require("node:test");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

// A separate process gives module-level models their own DATA_FILE without changing test globals.
test("models reject invalid direct calls without relying on HTTP validation middleware", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "router-models-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const script = `
    const assert = require("node:assert/strict");
    const Todo = require("./modules/router/01-todo/models/todoModel");
    const Note = require("./modules/router/02-notes/models/noteModel");
    const Book = require("./modules/router/03-reading-list/models/bookModel");
    (async () => {
      await assert.rejects(Todo.create({ title: " " }), { statusCode: 422 });
      await assert.rejects(Book.create({ title: 42 }), { statusCode: 422 });
      await assert.rejects(Note.create({ title: "Valid", text: "" }), { statusCode: 422 });
      await assert.rejects(Note.updateText("missing", null), { statusCode: 422 });
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  await promisify(execFile)(process.execPath, ["-e", script], {
    cwd: path.resolve(__dirname, "../../.."),
    env: { ...process.env, DATA_FILE: path.join(directory, "data.json") },
  });
  assert.deepEqual(await fs.readdir(directory), []);
});
