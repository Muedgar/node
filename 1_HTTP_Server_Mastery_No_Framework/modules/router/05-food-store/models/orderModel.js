const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createStore } = require("../../routes-fundamentals/09-file-store");
const {
  assertInput,
  findById,
} = require("../../routes-fundamentals/10-validation");

const dataFile = process.env.DATA_FILE || path.join(__dirname, "../data.json");
const store = createStore(dataFile, {
  products: [
    { id: "rice", name: "Rice", priceCents: 500, stock: 5 },
    { id: "beans", name: "Beans", priceCents: 300, stock: 3 },
  ],
  orders: [],
});

async function products() {
  return (await store.read()).products;
}
async function find(id) {
  return findById((await store.read()).orders, id, "Order");
}

// This normalization is order-specific business logic, not an HTTP parser.
function normalizeItems(requestedItems) {
  assertInput(
    Array.isArray(requestedItems) &&
      requestedItems.length > 0 &&
      requestedItems.length <= 20,
    422,
    "1 to 20 items required"
  );
  const quantities = new Map();
  for (const item of requestedItems) {
    assertInput(
      item &&
        typeof item.productId === "string" &&
        item.productId.trim() &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 100,
      422,
      "Invalid order item"
    );
    quantities.set(
      item.productId,
      (quantities.get(item.productId) || 0) + item.quantity
    );
  }
  return [...quantities]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([productId, quantity]) => ({ productId, quantity }));
}

async function place(key, requestedItems) {
  assertInput(
    typeof key === "string" && key.trim() && key.length <= 100,
    422,
    "Idempotency-Key required (up to 100 characters)"
  );
  const items = normalizeItems(requestedItems);
  const fingerprint = JSON.stringify(items);
  return store.update((data) => {
    const existing = data.orders.find((order) => order.key === key);
    if (existing) {
      assertInput(
        existing.fingerprint === fingerprint,
        409,
        "Idempotency key reused with different items"
      );
      return { order: existing, replayed: true };
    }

    const orderLines = items.map((item) => {
      const product = findById(data.products, item.productId, "Product");
      assertInput(product.stock >= item.quantity, 409, "Insufficient stock");
      return { ...item, unitPriceCents: product.priceCents };
    });
    // Validate every line before mutating stock. Both stock and order commit together.
    for (const item of orderLines) {
      findById(data.products, item.productId, "Product").stock -= item.quantity;
    }
    const order = {
      id: randomUUID(),
      key,
      fingerprint,
      items: orderLines,
      totalCents: orderLines.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0
      ),
      status: "placed",
    };
    data.orders.push(order);
    return { order, replayed: false };
  });
}

async function cancel(id) {
  return store.update((data) => {
    const order = findById(data.orders, id, "Order");
    if (order.status === "cancelled") return order;
    for (const item of order.items) {
      findById(data.products, item.productId, "Product").stock += item.quantity;
    }
    order.status = "cancelled";
    return order;
  });
}

module.exports = { products, find, place, cancel };
