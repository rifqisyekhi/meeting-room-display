/* Rute internal untuk bot Telegram yang berjalan di PC operator.

   Berbeda dari rute notulen biasa (yang dijaga cookie sesi Admin), jalur ini
   dipakai oleh proses tanpa manusia, jadi penjaganya token bersama.
   Token WAJIB: tanpa BOT_TELEGRAM_API_TOKEN seluruh rute menolak. Ini beda
   sikap dari webhook WhatsApp yang token-nya opsional — di sana ada bot lama
   yang harus tetap jalan, di sini tidak ada yang perlu ditenggang, dan jalur
   ini bisa menulis notulen. */

const express = require("express");
const router = express.Router();

const dashboardService = require("../services/dashboard.service");
const notulen = require("../services/notulen.service");
const bot = require("../services/bot-telegram.service");

function rute(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const kode = err.statusCode || 500;
      if (kode >= 500) console.warn("[bot-telegram]", err);
      if (!res.headersSent) {
        res.status(kode).json({
          success: false,
          error: kode === 500 ? `Kesalahan server: ${err.message}` : err.message,
        });
      }
    }
  };
}

/* Bandingkan token dengan waktu tetap: panjang yang beda langsung ditolak,
   sisanya dibanding byte demi byte tanpa korsleting lebih awal. */
const crypto = require("crypto");
function tokenSama(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function wajibToken(req, res, next) {
  const token = process.env.BOT_TELEGRAM_API_TOKEN;
  if (!token) {
    console.warn("[bot-telegram] BOT_TELEGRAM_API_TOKEN belum diisi — jalur bot ditutup.");
    return res.status(503).json({
      success: false,
      error: "Jalur bot belum dikonfigurasi di server (BOT_TELEGRAM_API_TOKEN).",
    });
  }
  if (!tokenSama(req.get("x-bot-token") || "", token)) {
    return res.status(401).json({ success: false, error: "Token bot tidak sah." });
  }
  next();
}

router.use(wajibToken);

async function muatRapat(req, res, next) {
  try {
    const meeting = await dashboardService.getMeetingById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, error: "Rapat tidak ditemukan." });
    req.rapat = meeting;
    const rooms = dashboardService.readStore().rooms || [];
    req.ruangan = rooms.find((r) => r.name === (meeting.room || meeting.roomName)) || null;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/* Daftar rapat BIASA yang transkripnya siap tapi notulennya belum ada.
   Sengaja hanya mengembalikan keterangan rapat — judul, tanggal, ruang —
   karena inilah satu-satunya data yang nanti dikirim bot ke Telegram. */
router.get("/antrian", rute(async (req, res) => {
  const calon = await bot.daftarCalon(req.query.limit);
  const hasil = [];
  for (const c of calon) {
    const meeting = await dashboardService.getMeetingById(c.meetingId).catch(() => null);
    if (!meeting) continue; // rapat sudah dihapus dari kalender
    hasil.push({
      meetingId: c.meetingId,
      title: meeting.title || "Rapat",
      date: meeting.date || null,
      start: meeting.start || null,
      end: meeting.end || null,
      room: meeting.room || meeting.roomName || null,
      segments: c.segments,
      durationSeconds: c.durationSeconds,
      updatedAt: c.updatedAt,
    });
  }
  res.json({ success: true, antrian: hasil });
}));

/* Transkrip untuk penyusun notulen di PC operator. Tetap di dalam jaringan:
   bot tidak meneruskan isi ini ke Telegram. */
router.get("/meetings/:id/transkrip", rute(async (req, res) => {
  res.json({ success: true, ...(await bot.ambilTranskrip(req.params.id)) });
}));

/* Keterangan rapat untuk header notulen, bentuknya sama dengan yang dipakai
   jalur normal supaya notulennya tidak beda format. */
router.get("/meetings/:id", muatRapat, rute(async (req, res) => {
  const m = req.rapat;
  res.json({
    success: true,
    meeting: {
      id: m.id,
      title: m.title || "Rapat",
      date: m.date || null,
      start: m.start || null,
      end: m.end || null,
      room: m.room || m.roomName || null,
      location: req.ruangan?.location || null,
      agenda: m.agenda || null,
      attendees: Array.isArray(m.attendees) ? m.attendees : [],
    },
    status: await notulen.statusRingan(m.id),
  });
}));

/* Jawaban "Ya" di Telegram: notulen disusun di luar, lalu disimpan di sini. */
router.post("/meetings/:id/minutes", rute(async (req, res) => {
  const { markdown, model } = req.body || {};
  const hasil = await bot.simpanDariLuar(req.params.id, markdown, model);
  res.json({ success: true, minutes: hasil });
}));

/* Jawaban "Tidak" di Telegram: pakai model lokal, lewat jalur normal. */
router.post("/meetings/:id/lokal", muatRapat, rute(async (req, res) => {
  const status = await notulen.buatUlangNotulen(
    req.rapat,
    req.ruangan,
    { llmModel: req.body?.llmModel },
    "Telegram/lokal",
  );
  res.json({ success: true, status });
}));

module.exports = router;
