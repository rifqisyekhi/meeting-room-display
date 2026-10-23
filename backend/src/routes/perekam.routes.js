const express = require("express");
const router = express.Router();

const perekam = require("../services/perekam.service");

/* Rute untuk perangkat perekam ruang rapat (halaman /perekam) dan papan TV.
   TIDAK memakai login: perangkat diautentikasi dengan token hasil pemasangan
   (header X-Perangkat-Token). Pengelolaan perangkat ada di /api/notulen/perekam
   yang khusus Admin. */

perekam.mulaiProsesOtomatis();

function rute(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const kode = err.statusCode || 500;
      if (kode >= 500 && kode !== 503) console.warn("[Perekam]", err);
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

async function wajibPerangkat(req, res, next) {
  try {
    const perangkat = await perekam.perangkatDariToken(req.get("X-Perangkat-Token"));
    if (!perangkat) {
      return res.status(401).json({
        success: false,
        perluPasang: true,
        error: "Perangkat belum dipasangkan atau sudah dicabut Admin. Masukkan kode pemasangan baru.",
      });
    }
    req.perangkat = perangkat;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Papan TV: ruangan mana yang sedang direkam (publik, hanya ya/tidak).
router.get("/status-ruang", rute(async (_req, res) => {
  res.json({ success: true, ruang: await perekam.statusRuang() });
}));

// Tukar kode pemasangan (dari Admin) dengan token perangkat.
router.post("/pasang", rute(async (req, res) => {
  res.json({ success: true, ...(await perekam.pasang(req.body?.kode)) });
}));

router.post("/detak", wajibPerangkat, rute(async (req, res) => {
  res.json({ success: true, ...(await perekam.detak(req.perangkat, req.body || {})) });
}));

router.post("/rekaman", wajibPerangkat, rute(async (req, res) => {
  res.status(201).json({ success: true, file: await perekam.mulaiRekam(req.perangkat, req.body || {}) });
}));

router.put(
  "/rekaman/:fileId/potongan/:seq",
  express.raw({ type: () => true, limit: "10mb" }),
  wajibPerangkat,
  rute(async (req, res) => {
    const hasil = await perekam.tambahPotongan(req.perangkat, req.params.fileId, Number(req.params.seq), req.body);
    res.json({ success: true, ...hasil });
  }),
);

router.post("/rekaman/:fileId/selesai", wajibPerangkat, rute(async (req, res) => {
  res.json({ success: true, file: await perekam.selesaiRekam(req.perangkat, req.params.fileId) });
}));

module.exports = router;
