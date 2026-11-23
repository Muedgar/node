const express = require("../../routes-fundamentals/08-application");
const todoController = require("../controllers/todoController");
const { requireFields } = require("../../routes-fundamentals/10-validation");

const router = express.Router();

router.get("/", todoController.index);
router.post("/", requireFields("title"), todoController.create);
router.get("/:id", todoController.show);
router.patch("/:id", todoController.update);
router.delete("/:id", todoController.destroy);

module.exports = router;
