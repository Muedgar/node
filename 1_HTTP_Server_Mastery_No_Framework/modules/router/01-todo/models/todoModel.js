const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createStore } = require("../../routes-fundamentals/09-file-store");
const {
  assertInput,
  findById,
  nonEmptyString,
} = require("../../routes-fundamentals/10-validation");

const dataFile = process.env.DATA_FILE || path.join(__dirname, "../data.json");
const store = createStore(dataFile, { todos: [] });

async function list({ done } = {}) {
  const { todos } = await store.read();
  return todos.filter((todo) => done === undefined || todo.done === done);
}

async function find(id) {
  return findById((await store.read()).todos, id, "Todo");
}

async function create({ title }) {
  nonEmptyString(title, "title");
  const todo = { id: randomUUID(), title: title.trim(), done: false };
  await store.update((data) => {
    data.todos.push(todo);
  });
  return todo;
}

async function setDone(id, done) {
  assertInput(typeof done === "boolean", 422, "done must be boolean");
  return store.update((data) => {
    const todo = findById(data.todos, id, "Todo");
    todo.done = done;
    return todo;
  });
}

async function remove(id) {
  await store.update((data) => {
    const todo = findById(data.todos, id, "Todo");
    data.todos.splice(data.todos.indexOf(todo), 1);
  });
}

module.exports = { list, find, create, setDone, remove };
