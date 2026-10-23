const express = require("express");
const cors = require("cors");

const calendarRoutes = require("./routes/calendar.routes");
const prayerRoutes = require("./routes/prayer.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const notulenRoutes = require("./routes/notulen.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/events", calendarRoutes);
app.use("/api/prayer", prayerRoutes);
app.use("/api/dashboard", dashboardRoutes);
// Notulen otomatis (khusus Admin): rekam/unggah audio → transkrip → notulen via service AI lokal.
app.use("/api/notulen", notulenRoutes);

app.post("/api/auth/login", async (req, res) => {
  try {
    const dashboardService = require("./services/dashboard.service");
    const { username, password } = req.body;
    const result = await dashboardService.authenticateUser(username, password);
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
