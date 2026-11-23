const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("../tests/http");
const serverFile = require("node:path").join(__dirname, "server.js");
const interval = { start: "2027-01-01T10:00:00Z", end: "2027-01-01T11:00:00Z" };

test("concurrent overlapping reservations produce exactly one winner", async (t) => {
  const f = await fixture(t, serverFile);
  const results = await Promise.all(
    [1, 2].map(() =>
      f.request("/api/rooms/blue/bookings", { method: "POST", body: interval })
    )
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await f.read()).bookings.length, 1);
});

test("adjacent intervals, cancellation, room isolation and persistence", async (t) => {
  const f = await fixture(t, serverFile);
  const booking = await f.request("/api/rooms/blue/bookings", {
    method: "POST",
    body: interval,
  });
  assert.equal(
    (
      await f.request("/api/rooms/blue/bookings", {
        method: "POST",
        body: { start: interval.end, end: "2027-01-01T12:00:00Z" },
      })
    ).status,
    201
  );
  assert.equal(
    (
      await f.request("/api/rooms/green/bookings", {
        method: "POST",
        body: interval,
      })
    ).status,
    201
  );
  assert.equal(
    (await f.request(`/api/bookings/${booking.json.id}`, { method: "DELETE" }))
      .status,
    204
  );
  await f.restart();
  assert.equal(
    (await f.read()).bookings.find((item) => item.id === booking.json.id)
      .cancelled,
    true
  );
  assert.equal(
    (
      await f.request("/api/rooms/blue/bookings", {
        method: "POST",
        body: interval,
      })
    ).status,
    201
  );
});

test("invalid intervals do not mutate persistent bookings", async (t) => {
  const f = await fixture(t, serverFile);
  assert.equal(
    (
      await f.request("/api/rooms/blue/bookings", {
        method: "POST",
        body: { start: interval.end, end: interval.start },
      })
    ).status,
    422
  );
  assert.equal(
    (
      await f.request("/api/rooms/missing/bookings", {
        method: "POST",
        body: interval,
      })
    ).status,
    404
  );
  assert.equal((await f.read()).bookings.length, 0);
});

test("calendar rollover is rejected instead of silently changing the requested day", async (t) => {
  const f = await fixture(t, serverFile);
  assert.equal(
    (
      await f.request("/api/rooms/blue/bookings", {
        method: "POST",
        body: {
          start: "2027-02-30T10:00:00Z",
          end: "2027-03-03T11:00:00Z",
        },
      })
    ).status,
    422
  );
});
