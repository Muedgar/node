function product({ id, name, priceCents, stock }) {
  return { id, name, priceCents, stock };
}

function render({ id, items, totalCents, status }) {
  return {
    id,
    items: items.map(({ productId, quantity, unitPriceCents }) => ({
      productId,
      quantity,
      unitPriceCents,
    })),
    totalCents,
    status,
  };
}

module.exports = { product, render };
