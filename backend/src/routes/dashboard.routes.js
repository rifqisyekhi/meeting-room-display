const express = require("express");
const router = express.Router();
const dashboardService = require("../services/dashboard.service");

// Ambil seluruh data dashboard (Google Calendar + Ruangan + Pengguna)
router.get("/data", async (req, res) => {
  try {
    const data = await dashboardService.getDashboardData();
    res.json(data);
  } catch (err) {
    console.error("Dashboard data route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Simpan / update rapat
router.post("/meetings", (req, res) => {
  try {
    const saved = dashboardService.saveMeeting(req.body);
    res.json({ success: true, meeting: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus rapat
router.delete("/meetings/:id", (req, res) => {
  try {
    const ok = dashboardService.deleteMeeting(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simpan / update ruangan
router.post("/rooms", (req, res) => {
  try {
    const saved = dashboardService.saveRoom(req.body);
    res.json({ success: true, room: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simpan / update pengguna
router.post("/users", (req, res) => {
  try {
    const saved = dashboardService.saveUser(req.body);
    res.json({ success: true, user: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus pengguna
router.delete("/users/:id", (req, res) => {
  try {
    const ok = dashboardService.deleteUser(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
