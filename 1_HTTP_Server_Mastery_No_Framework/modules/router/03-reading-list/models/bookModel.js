const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createStore } = require("../../routes-fundamentals/09-file-store");
const {
  assertInput,
  findById,
  nonEmptyString,
} = require("../../routes-fundamentals/10-validation");

const STATUSES = Object.freeze(["planned", "reading", "finished"]);
const transitions = new Map([
  ["planned", "reading"],
  ["reading", "finished"],
]);
const dataFile = process.env.DATA_FILE || path.join(__dirname, "../data.json");
const store = createStore(dataFile, { books: [] });

async function list({ status } = {}) {
  const { books } = await store.read();
  return books.filter((book) => status === undefined || book.status === status);
}

async function find(id) {
  return findById((await store.read()).books, id, "Book");
}

async function create({ title }) {
  nonEmptyString(title, "title");
  const book = { id: randomUUID(), title: title.trim(), status: "planned" };
  await store.update((data) => {
    data.books.push(book);
  });
  return book;
}

async function advance(id, status) {
  assertInput(STATUSES.includes(status), 422, "Unknown status");
  return store.update((data) => {
    const book = findById(data.books, id, "Book");
    assertInput(
      transitions.get(book.status) === status,
      409,
      "Invalid status transition"
    );
    book.status = status;
    return book;
  });
}

module.exports = { STATUSES, list, find, create, advance };
