const express = require("../routes-fundamentals/08-application");
const apiRoutes = require("./routes/apiRoutes");
const { errorHandler } = require("../routes-fundamentals/06-middleware");

const app = express();
app.use(express.json());
app.use("/api", apiRoutes);

app.use(errorHandler());

const port = Number(process.env.PORT || 3403);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`03-reading-list: http://127.0.0.1:${server.address().port}`);
});
