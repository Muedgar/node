const express = require("../../routes-fundamentals/08-application");
const bookController = require("../controllers/bookController");
const { requireFields } = require("../../routes-fundamentals/10-validation");

const router = express.Router();
router
  .route("/")
  .get(bookController.index)
  .post(requireFields("title"), bookController.create);
router
  .route("/:id")
  .get(bookController.show)
  .patch(requireFields("status"), bookController.update);

module.exports = router;
