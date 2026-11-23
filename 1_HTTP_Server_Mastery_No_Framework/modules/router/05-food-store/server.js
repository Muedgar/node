const express = require("../routes-fundamentals/08-application");
const orderRoutes = require("./routes/orderRoutes");
const { errorHandler } = require("../routes-fundamentals/06-middleware");

const app = express();
app.use(express.json());
app.use("/api", orderRoutes);
app.use(errorHandler({ project: "food-store" }));

const port = Number(process.env.PORT || 3405);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`05-food-store: http://127.0.0.1:${server.address().port}`);
});
