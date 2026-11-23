const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const queues = new Map();

// Stores for the same path must share a queue or concurrent updates can overwrite each other.
function createStore(filename, initial) {
  const file = path.resolve(filename);

  // Rejected operations must release the queue rather than block every later transaction.
  function enqueue(operation) {
    const result = (queues.get(file) || Promise.resolve()).then(operation);
    const tail = result.catch(() => {});
    queues.set(file, tail);
    tail.then(() => {
      if (queues.get(file) === tail) queues.delete(file);
    });
    return result;
  }

  // Rename publishes one complete snapshot; readers must never see half-written JSON.
  async function write(data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(data, null, 2) + "\n", {
        flag: "wx",
      });
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }

  // Seed only a missing file. Invalid JSON must be reported instead of erasing existing data.
  async function load() {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const seed = structuredClone(initial);
      await write(seed);
      return seed;
    }
  }

  // Reads join the queue so they cannot overtake an already-requested update.
  function read() {
    return enqueue(load);
  }

  // Change a private snapshot and commit only on success: validation failures roll back naturally.
  function update(change) {
    return enqueue(async () => {
      const data = await load();
      const result = await change(data);
      await write(data);
      return result;
    });
  }
  return { read, update };
}

module.exports = { createStore };
