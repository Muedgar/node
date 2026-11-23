const { randomUUID } = require("node:crypto");
const { dataFile } = require("../config");
const { createStore } = require("../../routes-fundamentals/09-file-store");
const {
  assertInput,
  findById,
  nonEmptyString,
} = require("../../routes-fundamentals/10-validation");

const store = createStore(dataFile, { notes: [] });

async function list(search = "") {
  const { notes } = await store.read();
  return notes.filter((note) =>
    `${note.title} ${note.text}`.toLowerCase().includes(search)
  );
}

async function find(id) {
  return findById((await store.read()).notes, id, "Note");
}

async function create({ title, text }) {
  nonEmptyString(title, "title");
  nonEmptyString(text, "text");
  const note = { id: randomUUID(), title: title.trim(), text, attachments: [] };
  await store.update((data) => {
    const duplicate = data.notes.some(
      (existing) => existing.title.toLowerCase() === note.title.toLowerCase()
    );
    assertInput(!duplicate, 409, "Title already exists");
    data.notes.push(note);
  });
  return note;
}

async function updateText(id, text) {
  nonEmptyString(text, "text");
  return store.update((data) => {
    const note = findById(data.notes, id, "Note");
    note.text = text;
    return note;
  });
}

async function addAttachments(id, files) {
  await store.update((data) => {
    const note = findById(data.notes, id, "Note");
    note.attachments.push(...files);
  });
}

module.exports = { list, find, create, updateText, addAttachments };
