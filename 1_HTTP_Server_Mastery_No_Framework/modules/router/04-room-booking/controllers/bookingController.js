const Booking = require("../models/bookingModel");
const bookingView = require("../views/bookingView");

async function rooms(req, res) {
  const rooms = await Booking.listRooms();
  res.json(rooms.map(bookingView.room));
}

async function index(req, res) {
  const bookings = await Booking.list();
  res.json(bookings.map(bookingView.render));
}

async function create(req, res) {
  const booking = await Booking.reserve(req.params.roomId, {
    start: req.body.start,
    end: req.body.end,
  });
  res.status(201).json(bookingView.render(booking));
}

async function destroy(req, res) {
  await Booking.cancel(req.params.id);
  res.status(204).end();
}

module.exports = { rooms, index, create, destroy };
