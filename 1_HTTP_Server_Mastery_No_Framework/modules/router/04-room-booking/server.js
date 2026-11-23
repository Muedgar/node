const express = require("../routes-fundamentals/08-application");
const bookingRoutes = require("./routes/bookingRoutes");
const { errorHandler } = require("../routes-fundamentals/06-middleware");

const app = express();
app.use(express.json());
app.use("/api", bookingRoutes);

app.use(errorHandler());

const port = Number(process.env.PORT || 3404);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`04-room-booking: http://127.0.0.1:${server.address().port}`);
});
