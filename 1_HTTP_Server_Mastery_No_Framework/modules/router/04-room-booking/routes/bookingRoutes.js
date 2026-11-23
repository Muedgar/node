const express = require("../../routes-fundamentals/08-application");
const bookingController = require("../controllers/bookingController");
const { requireFields } = require("../../routes-fundamentals/10-validation");

const router = express.Router();
router.get("/rooms", bookingController.rooms);
router.get("/bookings", bookingController.index);
router.post(
  "/rooms/:roomId/bookings",
  requireFields("start", "end"),
  bookingController.create
);
router.delete("/bookings/:id", bookingController.destroy);

module.exports = router;
