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
router.get("/meetings/:id", async (req, res) => {
  try {
    const meeting = await dashboardService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check-in rapat (Sistem 1: Barcode / QR Scan Otomatis, atau Sistem 2: Manual Admin)
router.post("/meetings/:id/checkin", async (req, res) => {
  try {
    const meeting = await dashboardService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }

    const method = req.body?.method || (req.body?.by && req.body.by.toLowerCase().includes("admin") ? "manual_admin" : "barcode_qr");
    const isAdmin = method === "manual_admin" || (req.body?.by && req.body.by.toLowerCase().includes("admin")) || (req.body?.role && req.body.role.toLowerCase().includes("admin"));

    const username = String(req.body?.username || "").trim().toLowerCase();
    const bookerUsername = String(meeting.bookedByUsername || "").trim().toLowerCase();
    const actorName = String(req.body?.by || "").trim().toLowerCase();
    const bookerName = String(meeting.bookedBy || "").trim().toLowerCase();
    const isBooker = bookerUsername ? username && username === bookerUsername : bookerName && actorName === bookerName;

    if (!isAdmin && !isBooker && req.body?.enforceBooker) {
      return res.status(403).json({ success: false, error: "Check-In hanya dapat dilakukan oleh akun pemesan ruangan atau Admin." });
    }

    const defaultActor = method === "manual_admin" ? "Admin (Manual)" : (meeting.bookedBy || "Peserta (Barcode / QR)");
    const checkedInBy = req.body?.by || defaultActor;
    const updated = await dashboardService.checkInMeeting(req.params.id, checkedInBy, method);

    if (!updated) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({
      success: true,
      meeting: updated,
      method: updated.checkInMethod,
      message: `Berhasil Check-In via ${updated.checkInMethodLabel || method}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check-out rapat (Sistem 1: Barcode / QR Scan Otomatis, atau Sistem 2: Manual Admin)
router.post("/meetings/:id/checkout", async (req, res) => {
  try {
    const meeting = await dashboardService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }

    const method = req.body?.method || (req.body?.by && req.body.by.toLowerCase().includes("admin") ? "manual_admin" : "barcode_qr");
    const isAdmin = method === "manual_admin" || (req.body?.by && req.body.by.toLowerCase().includes("admin")) || (req.body?.role && req.body.role.toLowerCase().includes("admin"));

    const username = String(req.body?.username || "").trim().toLowerCase();
    const bookerUsername = String(meeting.bookedByUsername || "").trim().toLowerCase();
    const actorName = String(req.body?.by || "").trim().toLowerCase();
    const bookerName = String(meeting.bookedBy || "").trim().toLowerCase();
    const isBooker = bookerUsername ? username && username === bookerUsername : bookerName && actorName === bookerName;

    if (!isAdmin && !isBooker && req.body?.enforceBooker) {
      return res.status(403).json({ success: false, error: "Check-Out hanya dapat dilakukan oleh akun pemesan ruangan atau Admin." });
    }

    const defaultActor = method === "manual_admin" ? "Admin (Manual)" : (meeting.bookedBy || "Peserta (Barcode / QR)");
    const checkedOutBy = req.body?.by || defaultActor;
    const updated = await dashboardService.checkOutMeeting(req.params.id, checkedOutBy, method);

    if (!updated) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({
      success: true,
      meeting: updated,
      method: updated.checkOutMethod,
      message: `Berhasil Check-Out via ${updated.checkOutMethodLabel || method}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tambah daftar hadir peserta (Attendance / Presensi Buku Tamu Rapat)
router.post("/meetings/:id/attendees", async (req, res) => {
  try {
    const result = await dashboardService.addMeetingAttendee(req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({ success: true, attendee: result.attendee, meeting: result.meeting });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tambah / Unggah materi rapat (PDF, Presentasi PPT, Dokumen, Link)
router.post("/meetings/:id/materials", async (req, res) => {
  try {
    const result = await dashboardService.addMeetingMaterial(req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan" });
    }
    res.json({ success: true, material: result.material, meeting: result.meeting });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hapus materi rapat
router.delete("/meetings/:id/materials/:materialId", async (req, res) => {
  try {
    const result = await dashboardService.deleteMeetingMaterial(req.params.id, req.params.materialId);
    if (!result) {
      return res.status(404).json({ success: false, error: "Materi atau rapat tidak ditemukan" });
    }
    res.json({ success: true, meeting: result.meeting });
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
router.post("/login", async (req, res) => {
  try {
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

// Perbarui password akun dengan verifikasi password saat ini.
router.post("/users/change-password", async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body || {};
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Semua kolom password wajib diisi." });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: "Password baru minimal 8 karakter." });
    }

    const result = await dashboardService.changeUserPassword(username, currentPassword, newPassword);
    if (!result.success) return res.status(401).json(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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
