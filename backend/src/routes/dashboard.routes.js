const express = require("express");
const router = express.Router();

const { pasangSesi, hapusSesi, bacaSesi, wajibLogin, wajibPeran } = require("../middleware/auth");

/* Mengisi req.user bila ada cookie sesi yang sah. Tidak menolak siapa pun di
   sini: rute papan TV dan halaman QR memang harus tetap terbuka. */
router.use(bacaSesi);
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

router.get("/materials/files/:fileName", (req, res) => {
  const safeFileName = String(req.params.fileName || "");
  if (!/^[0-9a-f-]{36}\.(pdf|ppt|pptx|doc|docx|xls|xlsx)$/i.test(safeFileName)) {
    return res.status(404).json({ success: false, error: "File tidak ditemukan." });
  }
  return res.sendFile(path.join(__dirname, "../../data/materials", safeFileName), (err) => {
    if (err && !res.headersSent) {
      res.status(err.statusCode === 404 ? 404 : 500).json({
        success: false,
        error: err.statusCode === 404 ? "File tidak ditemukan." : "Gagal membaca file materi.",
      });
    }
  });
});
const dashboardService = require("../services/dashboard.service");
const whatsappService = require("../services/whatsapp.service");
const notulenService = require("../services/notulen.service");

async function isAuthorizedCheckInOut(meeting, username, role, submittedName) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const bookedUsername = String(meeting.bookedByUsername || "").trim().toLowerCase();
  const bookedName = String(meeting.bookedBy || "").trim().toLowerCase();
  const normalizedSubmittedName = String(submittedName || "").trim().toLowerCase();
  const accountRoleParam = String(role || "").trim().toLowerCase();

  // 1. Role Admin, Pimpinan, dan Approval selalu diizinkan
  if (
    accountRoleParam === "admin" ||
    accountRoleParam === "pimpinan" ||
    accountRoleParam === "approval" ||
    normalizedUsername === "admin" ||
    normalizedUsername.startsWith("approval")
  ) {
    return true;
  }

  // 2. Akun pemesan ruangan cocok username
  if (normalizedUsername && bookedUsername && normalizedUsername === bookedUsername) {
    return true;
  }

  // 3. Cek data user dari database / store
  let users = [];
  try {
    users = await dashboardService.getUsers();
  } catch (e) {
    const store = dashboardService.readStore();
    users = store.users || [];
  }

  const user = (Array.isArray(users) ? users : []).find(
    (candidate) =>
      String(candidate.username || "").trim().toLowerCase() === normalizedUsername,
  );
  const accountName = String(user?.name || "").trim().toLowerCase();
  const accountRole = String(user?.role || "").trim().toLowerCase();

  if (
    accountRole === "admin" ||
    accountRole === "pimpinan" ||
    accountRole === "approval"
  ) {
    return true;
  }

  // 4. Akun pemesan ruangan cocok nama
  return Boolean(
    (normalizedUsername && bookedUsername && normalizedUsername === bookedUsername) ||
    (bookedName && (accountName === bookedName || normalizedSubmittedName === bookedName)),
  );
}

async function isMeetingBooker(meeting, username, submittedName) {
  return await isAuthorizedCheckInOut(meeting, username, "", submittedName);
}

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

// Ambil seluruh daftar rapat (untuk User Dashboard & sinkronisasi frontend)
router.get("/meetings", async (req, res) => {
  try {
    const data = await dashboardService.getDashboardData();
    res.json(data.meetings || []);
  } catch (err) {
    console.error("Dashboard get meetings route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Simpan / update rapat (otomatis sinkron ke Google Calendar & notif WA atasan jika butuh approval)
router.post("/meetings", wajibLogin, async (req, res) => {
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
    /* 409 untuk bentrok jadwal dan 400 untuk masukan tidak lengkap, supaya
       frontend bisa menampilkan pesannya apa adanya ke pemesan alih-alih
       "terjadi kesalahan" yang tidak membantu. */
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// Webhook untuk balasan WhatsApp Atasan (Ketik 1 = Approve, 2 = Tolak)
/* Webhook dari bot SisKA. Inilah jalur yang MENYETUJUI rapat, jadi harus
   dibedakan dari permintaan biasa — tanpa penjagaan, satu permintaan HTTP
   dari siapa pun bisa meloloskan permohonan rapat.

   Token dibuat opsional dengan sengaja: bot-nya berjalan terpisah dan
   belum tentu sempat dikonfigurasi bersamaan dengan deploy ini. Selama
   BOT_SISKA_WEBHOOK_TOKEN kosong, jalur ini tetap terbuka dan backend
   memperingatkan di log setiap kali dipakai. Isi variabel itu di kedua
   sisi untuk menutupnya. */
function webhookTerpercaya(req, res, next) {
  const token = process.env.BOT_SISKA_WEBHOOK_TOKEN;
  if (!token) {
    console.warn(
      "[webhook] BOT_SISKA_WEBHOOK_TOKEN belum diisi — jalur persetujuan WhatsApp terbuka untuk siapa saja."
    );
    return next();
  }
  const dikirim = req.get("x-webhook-token") || req.body?.token || "";
  if (dikirim !== token) {
    return res.status(401).json({ success: false, error: "Token webhook tidak sah." });
  }
  next();
}

router.post("/whatsapp/reply", webhookTerpercaya, async (req, res) => {
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
router.post("/whatsapp/notify/:id", wajibLogin, async (req, res) => {
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
router.delete("/meetings/:id", wajibPeran("Admin", "Pimpinan"), async (req, res) => {
  try {
    // ID kanonik diambil sebelum rapat dihapus, untuk membersihkan data notulennya.
    const sebelumHapus = await dashboardService.getMeetingById(req.params.id).catch(() => null);
    const ok = await dashboardService.deleteMeeting(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan di database maupun Google Calendar." });
    }
    // Audio rapat bersifat rahasia: jangan tertinggal setelah rapatnya dihapus.
    await notulenService
      .hapusDataNotulen(sebelumHapus?.id || req.params.id)
      .catch((err) => console.warn("[Notulen] Gagal menghapus data notulen:", err.message));
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
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
    const username = String(req.user?.u || req.body?.username || "").trim().toLowerCase();
    /* Peran diambil dari cookie sesi, tidak pernah dari badan permintaan.
       Sebelumnya siapa pun bisa menambahkan "role":"admin" lalu lolos. */
    const role = String(req.user?.r || "").trim().toLowerCase();
    const isAuthorized = await isAuthorizedCheckInOut(meeting, username, role, req.body?.by);

    const bolehManual = role === "admin" || role === "pimpinan";
    if (!(method === "manual_admin" && bolehManual) && !isAuthorized) {
      return res.status(403).json({ success: false, error: "Check-In hanya dapat dilakukan oleh akun pemesan ruangan, Admin, atau Approval." });
    }

    const bookerPicName = meeting.bookedBy || meeting.bookedByUsername || meeting.requester || "Pemesan Ruangan";
    const defaultActor = method === "manual_admin" ? "Admin (Manual)" : bookerPicName;
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
    const username = String(req.user?.u || req.body?.username || "").trim().toLowerCase();
    /* Peran diambil dari cookie sesi, tidak pernah dari badan permintaan.
       Sebelumnya siapa pun bisa menambahkan "role":"admin" lalu lolos. */
    const role = String(req.user?.r || "").trim().toLowerCase();
    const isAuthorized = await isAuthorizedCheckInOut(meeting, username, role, req.body?.by);

    const bolehManual = role === "admin" || role === "pimpinan";
    if (!(method === "manual_admin" && bolehManual) && !isAuthorized) {
      return res.status(403).json({ success: false, error: "Check-Out hanya dapat dilakukan oleh akun pemesan ruangan, Admin, atau Approval." });
    }

    const bookerPicName = meeting.bookedBy || meeting.bookedByUsername || meeting.requester || "Pemesan Ruangan";
    const defaultActor = method === "manual_admin" ? "Admin (Manual)" : bookerPicName;
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

// Unggah file biner langsung agar tidak dikonversi menjadi Base64 di JSON.
router.post(
  "/meetings/:id/materials/file",
  express.raw({ type: "application/octet-stream", limit: "20mb" }),
  async (req, res) => {
    let storedFilePath = null;
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ success: false, error: "File kosong atau tidak terbaca." });
      }

      const decodeHeader = (value, fallback = "") => {
        try { return decodeURIComponent(value || fallback); } catch { return fallback; }
      };
      const originalName = path.basename(decodeHeader(req.get("X-File-Name"), "materi"));
      const ext = path.extname(originalName).toLowerCase();
      const allowedExtensions = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx"]);
      if (!allowedExtensions.has(ext)) {
        return res.status(415).json({ success: false, error: "Format file tidak didukung." });
      }

      const fileName = `${crypto.randomUUID()}${ext}`;
      const uploadDir = path.join(__dirname, "../../data/materials");
      storedFilePath = path.join(uploadDir, fileName);
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(storedFilePath, req.body, { flag: "wx" });

      const result = await dashboardService.addMeetingMaterial(req.params.id, {
        name: decodeHeader(req.get("X-Material-Name"), originalName),
        type: ext.slice(1),
        url: `/api/dashboard/materials/files/${fileName}`,
        size: req.body.length < 1024 * 1024
          ? `${(req.body.length / 1024).toFixed(1)} KB`
          : `${(req.body.length / (1024 * 1024)).toFixed(1)} MB`,
        uploadedBy: decodeHeader(req.get("X-Uploaded-By"), "Pengguna"),
      });
      if (!result) {
        await fs.unlink(storedFilePath).catch(() => {});
        return res.status(404).json({ success: false, error: "Rapat tidak ditemukan." });
      }
      return res.json({ success: true, ...result });
    } catch (err) {
      if (storedFilePath) await fs.unlink(storedFilePath).catch(() => {});
      const tooLarge = err.type === "entity.too.large" || err.status === 413;
      return res.status(tooLarge ? 413 : 500).json({
        success: false,
        error: tooLarge ? "Ukuran file maksimal 20 MB." : err.message,
      });
    }
  },
);

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
router.post("/rooms", wajibPeran("Admin"), async (req, res) => {
  try {
    const saved = await dashboardService.saveRoom(req.body);
    res.json({ success: true, room: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/rooms/:id", wajibPeran("Admin"), async (req, res) => {
  try {
    const ok = await dashboardService.deleteRoom(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Ruangan tidak ditemukan." });
    return res.json({ success: true });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.get("/roles", wajibLogin, async (req, res) => {
  try {
    return res.json(await dashboardService.getRoles());
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/roles", wajibPeran("Admin"), async (req, res) => {
  try {
    const role = await dashboardService.saveRole(req.body || {});
    return res.json({ success: true, role });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

router.delete("/roles/:name", wajibPeran("Admin"), async (req, res) => {
  try {
    const ok = await dashboardService.deleteRole(req.params.name);
    if (!ok) return res.status(404).json({ success: false, error: "Role tidak ditemukan." });
    return res.json({ success: true });
  } catch (err) {
    return res.status(err.statusCode || 409).json({ success: false, error: err.message });
  }
});

// Ambil seluruh daftar pengguna
router.get("/users", wajibPeran("Admin"), async (req, res) => {
  try {
    const users = await dashboardService.getUsers();
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
      /* Sejak sini identitas dipegang server lewat cookie bertanda tangan.
         Balasan JSON tetap dikirim utuh supaya frontend yang sudah ada
         (yang menyimpan profil di sessionStorage) tidak perlu diubah. */
      pasangSesi(res, result.user);
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Perbarui password akun dengan verifikasi password saat ini.
router.post("/logout", (req, res) => {
  hapusSesi(res);
  res.json({ success: true });
});

/* Dipakai frontend untuk menanyakan "saya masih login sebagai siapa?"
   tanpa menebak-nebak dari sessionStorage yang bisa basi. */
router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, user: null });
  res.json({ success: true, user: { username: req.user.u, role: req.user.r, name: req.user.n } });
});

router.post("/users/change-password", wajibLogin, async (req, res) => {
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
router.post("/users", wajibPeran("Admin"), async (req, res) => {
  try {
    const saved = await dashboardService.saveUser(req.body);
    res.json({ success: true, user: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus pengguna
router.delete("/users/:id", wajibPeran("Admin"), async (req, res) => {
  try {
    const ok = await dashboardService.deleteUser(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: "Pengguna tidak ditemukan." });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
