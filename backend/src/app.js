const express = require("express");
const cors = require("cors");

const calendarRoutes = require("./routes/calendar.routes");
const prayerRoutes = require("./routes/prayer.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/events", calendarRoutes);
app.use("/api/prayer", prayerRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.post("/api/auth/login", (req, res) => {
  try {
    const dashboardService = require("./services/dashboard.service");
    const { username, password } = req.body;
    const result = dashboardService.authenticateUser(username, password);
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const BACKEND_DEV_SESSION_ID = "dev_be_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

app.get("/api/dev-session", (req, res) => {
  res.json({
    sessionId: BACKEND_DEV_SESSION_ID,
    active: true,
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Meeting Room Display API",
  });
});


module.exports = app;