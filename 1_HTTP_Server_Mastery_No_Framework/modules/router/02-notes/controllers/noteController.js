const Note = require("../models/noteModel");
const noteView = require("../views/noteView");
const { uploadDir } = require("../config");
const { singleValue } = require("../../routes-fundamentals/02-query-parser");
const { assertInput } = require("../../routes-fundamentals/10-validation");
const {
  removeUploadedFiles,
} = require("../../routes-fundamentals/04-upload-parser");

async function index(req, res) {
  const search = singleValue(req.query.q, "q", "").toLowerCase();
  const notes = await Note.list(search);
  res.json(notes.map(noteView.render));
}

async function show(req, res) {
  const note = await Note.find(req.params.id);
  res.json(noteView.render(note));
}

async function create(req, res) {
  const note = await Note.create({
    title: req.body.title,
    text: req.body.text,
  });
  res.status(201).json(noteView.render(note));
}

async function update(req, res) {
  const note = await Note.updateText(req.params.id, req.body.text);
  res.json(noteView.render(note));
}

async function ensureExists(req, res, next) {
  await Note.find(req.params.id);
  return next();
}

async function attach(req, res) {
  assertInput(req.files?.length, 422, "At least one attachment required");
  try {
    await Note.addAttachments(req.params.id, req.files);
  } catch (error) {
    // Files and metadata are different resources; undo files if metadata fails.
    try {
      await removeUploadedFiles(uploadDir, req.files);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Metadata commit and cleanup failed"
      );
    }
    throw error;
  }
  res.status(201).json(req.files.map(noteView.attachment));
}

module.exports = { index, show, create, update, ensureExists, attach };
