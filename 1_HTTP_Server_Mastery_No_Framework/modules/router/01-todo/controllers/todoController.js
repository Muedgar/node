const Todo = require("../models/todoModel");
const todoView = require("../views/todoView");
const { parseBoolean } = require("../../routes-fundamentals/02-query-parser");

async function index(req, res) {
  const done = parseBoolean(req.query.done, "done", undefined);
  const todos = await Todo.list({ done });
  res.json(todos.map(todoView.render));
}

async function show(req, res) {
  const todo = await Todo.find(req.params.id);
  res.json(todoView.render(todo));
}

async function create(req, res) {
  const todo = await Todo.create({ title: req.body.title });
  res.status(201).json(todoView.render(todo));
}

async function update(req, res) {
  const todo = await Todo.setDone(req.params.id, req.body?.done);
  res.json(todoView.render(todo));
}

async function destroy(req, res) {
  await Todo.remove(req.params.id);
  res.status(204).end();
}

module.exports = { index, show, create, update, destroy };
