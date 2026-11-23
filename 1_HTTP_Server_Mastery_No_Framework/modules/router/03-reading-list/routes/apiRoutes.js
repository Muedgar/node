const express = require("../../routes-fundamentals/08-application");
const bookRoutes = require("./bookRoutes");
const {
  setResponseHeader,
} = require("../../routes-fundamentals/06-middleware");

const router = express.Router();
router.use(setResponseHeader("X-API-Version", "1"));
router.use("/books", bookRoutes);

module.exports = router;
