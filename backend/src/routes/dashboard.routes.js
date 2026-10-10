const express = require("express");
const router = express.Router();
const dashboardService = require("../services/dashboard.service");
const whatsappService = require("../services/whatsapp.service");

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

// Simpan / update rapat (otomatis sinkron ke Google Calendar & notif WA atasan jika butuh approval)
router.post("/meetings", async (req, res) => {
  try {
    const saved = await dashboardService.saveMeeting(req.body);

    // Jika status "Menunggu Approval", kirim notifikasi WhatsApp ke Atasan
    if (saved.status === "Menunggu Approval") {
      whatsappService.sendNotificationToApprovers(saved).catch((err) => {
        console.error("Gagal kirim notifikasi WA:", err.message);
      });
    }

    res.json({ success: true, meeting: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook untuk balasan WhatsApp Atasan (Ketik 1 = Approve, 2 = Tolak)
router.post("/whatsapp/reply", async (req, res) => {
  try {
    const result = await whatsappService.handleApproverReply(req.body);
    res.json({
      success: result.success,
      action: result.action || null,
      replyText: result.replyText,
      message: result.replyText,
    });
  } catch (err) {
    console.error("WhatsApp webhook reply error:", err);
    res.status(500).json({
      success: false,
      replyText: "Terjadi kesalahan internal pada sistem saat memproses permohonan.",
      error: err.message,
    });
  }
});

// Manual trigger kirim ulang notifikasi WhatsApp permohonan rapat ke Atasan
router.post("/whatsapp/notify/:id", async (req, res) => {
  try {
    const store = dashboardService.readStore();
    const meeting = (store.meetings || []).find((m) => String(m.id) === String(req.params.id));

    if (!meeting) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }

    const result = await whatsappService.sendNotificationToApprovers(meeting);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hapus rapat (otomatis hapus dari Google Calendar)
router.delete("/meetings/:id", async (req, res) => {
  try {
    const ok = await dashboardService.deleteMeeting(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ambil detail 1 rapat berdasarkan ID (untuk Halaman QR Pass / Presensi)
router.get("/meetings/:id", (req, res) => {
  try {
    const meeting = dashboardService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check-in rapat via QR / Web
router.post("/meetings/:id/checkin", async (req, res) => {
  try {
    const checkedInBy = req.body?.by || "Peserta via QR";
    const updated = await dashboardService.checkInMeeting(req.params.id, checkedInBy);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({ success: true, meeting: updated, message: "Berhasil Check-In" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check-out rapat via QR / Web
router.post("/meetings/:id/checkout", async (req, res) => {
  try {
    const checkedOutBy = req.body?.by || "Peserta via QR";
    const updated = await dashboardService.checkOutMeeting(req.params.id, checkedOutBy);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({ success: true, meeting: updated, message: "Berhasil Check-Out" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tambah daftar hadir peserta (Attendance / Presensi Buku Tamu Rapat)
router.post("/meetings/:id/attendees", (req, res) => {
  try {
    const result = dashboardService.addMeetingAttendee(req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({ success: true, attendee: result.attendee, meeting: result.meeting });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

// Ambil seluruh daftar pengguna
router.get("/users", (req, res) => {
  try {
    const users = dashboardService.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Otentikasi login pengguna
router.post("/login", (req, res) => {
  try {
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
