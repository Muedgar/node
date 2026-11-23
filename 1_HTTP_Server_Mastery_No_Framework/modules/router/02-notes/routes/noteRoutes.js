const express = require("../../routes-fundamentals/08-application");
const noteController = require("../controllers/noteController");
const { uploadDir } = require("../config");
const { requireFields } = require("../../routes-fundamentals/10-validation");

const router = express.Router();
const upload = express.multipart({
  uploadDir,
  maxBodyBytes: 30_000,
  maxFileBytes: 10_000,
});

router.get("/", noteController.index);
router.post("/", requireFields("title", "text"), noteController.create);
router.get("/:id", noteController.show);
router.patch("/:id", requireFields("text"), noteController.update);
router.post(
  "/:id/attachments",
  noteController.ensureExists,
  upload,
  noteController.attach
);

module.exports = router;
