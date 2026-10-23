const express = require("express");
const router = express.Router();

const { bacaSesi, wajibPeran } = require("../middleware/auth");
const dashboardService = require("../services/dashboard.service");
const notulen = require("../services/notulen.service");

/* Seluruh fitur notulen otomatis khusus Admin (menu Manajemen Rapat).
   Peran dibaca dari cookie sesi yang ditandatangani server. */
router.use(bacaSesi);
router.use(wajibPeran("Admin"));

notulen.mulaiPemantauJob();

function namaPengguna(req) {
  return req.user?.n || req.user?.u || "Admin";
}

/* Bungkus rute async agar error berstatus (galat) dikirim apa adanya dan
   error tak terduga tidak membuat permintaan menggantung. */
function rute(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const kode = err.statusCode || 500;
      if (kode >= 500 && kode !== 503) console.warn("[Notulen]", err);
      if (!res.headersSent) {
        res.status(kode).json({
          success: false,
          error: kode === 500 ? `Terjadi kesalahan pada server: ${err.message}` : err.message,
          ...(err.expectedSeq !== undefined ? { expectedSeq: err.expectedSeq } : {}),
        });
      }
    }
  };
}

/* Muat rapat dari :id. Penyimpanan selalu memakai meeting.id kanonik, bukan
   ID dari URL (bisa berupa ID Google Calendar). */
async function muatRapat(req, res, next) {
  try {
    const meeting = await dashboardService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: "Rapat tidak ditemukan." });
    }
    req.rapat = meeting;
    const rooms = dashboardService.readStore().rooms || [];
    req.ruangan = rooms.find((r) => r.name === (meeting.room || meeting.roomName)) || null;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

router.get("/status-ai", rute(async (_req, res) => {
  res.json({ success: true, ai: await notulen.statusServiceAI() });
}));

router.get("/meetings/:id", muatRapat, rute(async (req, res) => {
  const data = await notulen.ringkasan(req.rapat.id);
  res.json({
    success: true,
    meeting: {
      id: req.rapat.id,
      title: req.rapat.title,
      agenda: req.rapat.agenda || "",
      room: req.rapat.room || req.rapat.roomName || "",
      location: req.ruangan?.location || "",
      date: req.rapat.date,
      start: req.rapat.start,
      end: req.rapat.end,
      status: req.rapat.status,
      requester: req.rapat.requester,
      attendees: Array.isArray(req.rapat.attendees) ? req.rapat.attendees : [],
    },
    ...data,
  });
}));

// Status ringan untuk polling progress (tanpa transkrip & notulen).
router.get("/meetings/:id/status", muatRapat, rute(async (req, res) => {
  res.json({ success: true, minutes: await notulen.statusRingan(req.rapat.id) });
}));

// ---- Perekaman di browser: sesi → potongan berurutan → selesai ----
router.post("/meetings/:id/recordings", muatRapat, rute(async (req, res) => {
  const file = await notulen.mulaiSesiRekam(req.rapat.id, req.body || {}, namaPengguna(req));
  res.status(201).json({ success: true, file });
}));

router.put(
  "/meetings/:id/recordings/:fileId/chunks/:seq",
  express.raw({ type: () => true, limit: "10mb" }),
  muatRapat,
  rute(async (req, res) => {
    const hasil = await notulen.tambahPotongan(req.rapat.id, req.params.fileId, Number(req.params.seq), req.body);
    res.json({ success: true, ...hasil });
  }),
);

router.post("/meetings/:id/recordings/:fileId/finish", muatRapat, rute(async (req, res) => {
  res.json({ success: true, file: await notulen.selesaiRekam(req.rapat.id, req.params.fileId) });
}));

// ---- Unggah file audio yang sudah ada (dialirkan ke disk) ----
router.post("/meetings/:id/audio", muatRapat, rute(async (req, res) => {
  const file = await notulen.simpanUnggahan(req.rapat.id, req, namaPengguna(req));
  res.status(201).json({ success: true, file });
}));

router.get("/meetings/:id/audio/:fileId", muatRapat, rute(async (req, res) => {
  const { abs, file } = await notulen.pathFileUntukDiputar(req.rapat.id, req.params.fileId);
  if (file.mime_type) res.type(file.mime_type);
  res.sendFile(abs, { dotfiles: "deny" }, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, error: "File audio tidak ditemukan di disk." });
    }
  });
}));

router.delete("/meetings/:id/audio/:fileId", muatRapat, rute(async (req, res) => {
  await notulen.hapusFile(req.rapat.id, req.params.fileId);
  res.json({ success: true });
}));

// ---- Pemrosesan ----
router.post("/meetings/:id/process", muatRapat, rute(async (req, res) => {
  const minutes = await notulen.mulaiProses(req.rapat, req.ruangan, req.body || {}, namaPengguna(req));
  res.json({ success: true, minutes });
}));

router.post("/meetings/:id/regenerate", muatRapat, rute(async (req, res) => {
  const minutes = await notulen.buatUlangNotulen(req.rapat, req.ruangan, namaPengguna(req));
  res.json({ success: true, minutes });
}));

router.post("/meetings/:id/cancel", muatRapat, rute(async (req, res) => {
  await notulen.batalkanProses(req.rapat.id);
  res.json({ success: true });
}));

// ---- Penyuntingan ----
router.put("/meetings/:id/speakers", muatRapat, rute(async (req, res) => {
  const speakers = await notulen.simpanNamaPembicara(req.rapat.id, req.body?.speakers);
  res.json({ success: true, speakers });
}));

router.put("/meetings/:id/minutes", muatRapat, rute(async (req, res) => {
  const minutes = await notulen.simpanNotulen(req.rapat.id, req.body || {}, namaPengguna(req));
  res.json({ success: true, minutes });
}));

router.get("/meetings/:id/minutes.md", muatRapat, rute(async (req, res) => {
  const md = await notulen.ambilMarkdown(req.rapat.id);
  const nama = `Notulen - ${req.rapat.title || "Rapat"} - ${req.rapat.date || ""}`
    .replace(/[\\/:*?"<>|]+/g, " ").trim();
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nama)}.md`);
  res.send(md);
}));

module.exports = router;
