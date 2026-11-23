const Order = require("../models/orderModel");
const orderView = require("../views/orderView");

async function products(req, res) {
  const products = await Order.products();
  res.json(products.map(orderView.product));
}

async function show(req, res) {
  const order = await Order.find(req.params.id);
  res.json(orderView.render(order));
}

async function create(req, res) {
  const { order, replayed } = await Order.place(
    req.get("idempotency-key"),
    req.body?.items
  );
  res.status(replayed ? 200 : 201).json(orderView.render(order));
}

async function cancel(req, res) {
  const order = await Order.cancel(req.params.id);
  res.json(orderView.render(order));
}

module.exports = { products, show, create, cancel };
