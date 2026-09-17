const express = require("express");
const cors = require("cors");

const calendarRoutes = require("./routes/calendar.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/events", calendarRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Meeting Room Display API",
  });
});

module.exports = app;