const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createStore } = require("../../routes-fundamentals/09-file-store");
const {
  parseUtcInterval,
} = require("../../routes-fundamentals/02-query-parser");
const {
  assertInput,
  findById,
} = require("../../routes-fundamentals/10-validation");

const dataFile = process.env.DATA_FILE || path.join(__dirname, "../data.json");
const store = createStore(dataFile, {
  rooms: [
    { id: "blue", name: "Blue room" },
    { id: "green", name: "Green room" },
  ],
  bookings: [],
});

async function listRooms() {
  return (await store.read()).rooms;
}
async function list() {
  return (await store.read()).bookings;
}

async function reserve(roomId, interval) {
  const { start, end } = parseUtcInterval(interval.start, interval.end);
  const booking = {
    id: randomUUID(),
    roomId,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    cancelled: false,
  };
  await store.update((data) => {
    findById(data.rooms, roomId, "Room");
    const overlaps = data.bookings.some(
      (existing) =>
        !existing.cancelled &&
        existing.roomId === roomId &&
        start < Date.parse(existing.end) &&
        end > Date.parse(existing.start)
    );
    assertInput(!overlaps, 409, "Room already booked");
    data.bookings.push(booking);
  });
  return booking;
}

async function cancel(id) {
  await store.update((data) => {
    findById(data.bookings, id, "Booking").cancelled = true;
  });
}

module.exports = { listRooms, list, reserve, cancel };
