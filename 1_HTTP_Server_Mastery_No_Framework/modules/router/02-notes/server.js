const express = require("../routes-fundamentals/08-application");
const noteRoutes = require("./routes/noteRoutes");
const { errorHandler } = require("../routes-fundamentals/06-middleware");

const app = express();
app.use(express.json({ limit: 20_000 }));
app.use("/api/notes", noteRoutes);

app.use(errorHandler());

const port = Number(process.env.PORT || 3402);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`02-notes: http://127.0.0.1:${server.address().port}`);
});
