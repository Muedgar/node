// The Express-style API below is implemented with pure Node.js fundamentals.
const express = require("../routes-fundamentals/08-application");
const todoRoutes = require("./routes/todoRoutes");
const { errorHandler } = require("../routes-fundamentals/06-middleware");

const app = express();
app.use(express.json({ limit: 10_000 }));
app.use(express.urlencoded({ limit: 10_000 }));
app.use("/todos", todoRoutes);

app.use(errorHandler());

const port = Number(process.env.PORT || 3401);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`01-todo: http://127.0.0.1:${server.address().port}`);
});
