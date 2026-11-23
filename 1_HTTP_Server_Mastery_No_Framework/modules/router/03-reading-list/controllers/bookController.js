const Book = require("../models/bookModel");
const bookView = require("../views/bookView");
const { parseEnum } = require("../../routes-fundamentals/02-query-parser");

async function index(req, res) {
  const status = parseEnum(
    req.query.status,
    "status",
    Book.STATUSES,
    undefined
  );
  const books = await Book.list({ status });
  res.json(books.map(bookView.render));
}

async function show(req, res) {
  const book = await Book.find(req.params.id);
  res.json(bookView.render(book));
}

async function create(req, res) {
  const book = await Book.create({ title: req.body.title });
  res.status(201).json(bookView.render(book));
}

async function update(req, res) {
  const book = await Book.advance(req.params.id, req.body.status);
  res.json(bookView.render(book));
}

module.exports = { index, show, create, update };
