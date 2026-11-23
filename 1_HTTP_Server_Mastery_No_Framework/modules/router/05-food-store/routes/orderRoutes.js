const express = require("../../routes-fundamentals/08-application");
const orderController = require("../controllers/orderController");

const router = express.Router();
router.get("/products", orderController.products);
router.get("/orders/:id", orderController.show);
router.post("/orders", orderController.create);
router.post("/orders/:id/cancel", orderController.cancel);

module.exports = router;
