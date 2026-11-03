/* ===== JEMBATAN BOT TELEGRAM (notulen) ================================

   Bot Telegram tidak bisa berjalan di VPS: jaringan internal tidak
   meloloskan api.telegram.org (diuji 2 Nov 2026 — google.com 0,14 s,
   api.telegram.org timeout 20 s, TCP 443 ke IP hasil DNS-nya tertutup).
   Karena itu botnya berjalan di PC operator, yang bisa menjangkau
   Telegram sekaligus menjangkau backend ini lewat LAN.

   Berkas ini hanya menyediakan data yang dibutuhkan bot:
   - daftar rapat BIASA yang transkripnya siap tapi notulennya belum ada;
   - penyimpanan notulen yang disusun di luar (oleh Claude di PC operator).

   Yang TIDAK ada di sini, dengan sengaja:
   - isi transkrip. Bot tidak pernah menerimanya, jadi tidak ada isi rapat
     yang keluar ke server Telegram. Penyusun notulen mengambil transkrip
     langsung dari jaringan internal.
   - rapat non-BIASA. Kolom classification default-nya 'RAHASIA'
     (lihat db.js), jadi rapat hanya ikut setelah admin menandainya BIASA.
*/

const { query, getIsConnected } = require("../db");
const notulen = require("./notulen.service");

function galat(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function wajibDatabase() {
  if (!getIsConnected()) throw galat("Database tidak tersambung.", 503);
}

/* Rapat yang boleh ditawarkan ke Telegram. Syaratnya ketat supaya tidak ada
   rapat rahasia atau rapat yang sedang diproses yang ikut tertawar. */
async function daftarCalon(batas = 20) {
  wajibDatabase();
  const r = await query(
    `SELECT meeting_id, duration_seconds,
            jsonb_array_length(transcript) AS jml_segmen,
            to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS updated_at
       FROM meeting_minutes
      WHERE classification = 'BIASA'
        AND transcript IS NOT NULL
        AND jsonb_array_length(transcript) > 0
        AND (minutes_md IS NULL OR minutes_md = '')
        AND status <> 'PROCESSING'
        AND job_id IS NULL
      ORDER BY updated_at DESC
      LIMIT $1`,
    [Math.min(Math.max(Number(batas) || 20, 1), 100)],
  );
  return r.rows.map((b) => ({
    meetingId: b.meeting_id,
    segments: Number(b.jml_segmen) || 0,
    durationSeconds: b.duration_seconds,
    updatedAt: b.updated_at,
  }));
}

/* Transkrip untuk penyusun notulen. Hanya dipanggil dari dalam jaringan
   (lewat token bot), BUKAN dikirim ke Telegram. */
async function ambilTranskrip(meetingId) {
  wajibDatabase();
  const r = await query(
    `SELECT classification, transcript, speakers, duration_seconds
       FROM meeting_minutes WHERE meeting_id = $1`,
    [String(meetingId)],
  );
  const baris = r.rows[0];
  if (!baris) throw galat("Rapat tidak ditemukan.", 404);
  if (baris.classification !== "BIASA") {
    throw galat("Rapat ini bukan klasifikasi Biasa, transkripnya tidak boleh keluar.", 403);
  }
  if (!Array.isArray(baris.transcript) || !baris.transcript.length) {
    throw galat("Transkrip belum tersedia.", 404);
  }
  return {
    segments: baris.transcript.map((s) => ({
      start: s.start,
      end: s.end,
      speaker: s.speaker || null,
      text: s.text || "",
    })),
    speakers: baris.speakers || {},
    durationSeconds: baris.duration_seconds,
  };
}

/* Simpan notulen yang disusun di luar. Penanda "oleh" sengaja menyebut
   jalurnya supaya di UI terlihat ini bukan hasil model lokal. */
async function simpanDariLuar(meetingId, markdown, model) {
  wajibDatabase();
  if (typeof markdown !== "string" || !markdown.trim()) {
    throw galat("Isi notulen kosong.");
  }
  const r = await query(`SELECT classification FROM meeting_minutes WHERE meeting_id = $1`, [
    String(meetingId),
  ]);
  if (!r.rows[0]) throw galat("Rapat tidak ditemukan.", 404);
  if (r.rows[0].classification !== "BIASA") {
    throw galat("Rapat ini bukan klasifikasi Biasa.", 403);
  }
  const hasil = await notulen.simpanNotulen(
    meetingId,
    { markdown, reviewed: false },
    `Telegram/${model || "luar"}`,
  );
  if (model) {
    await query(`UPDATE meeting_minutes SET llm_model = $2 WHERE meeting_id = $1`, [
      String(meetingId),
      String(model).slice(0, 100),
    ]);
  }
  return hasil;
}

module.exports = { galat, daftarCalon, ambilTranskrip, simpanDariLuar };
