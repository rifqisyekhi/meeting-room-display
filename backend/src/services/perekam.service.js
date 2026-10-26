/* ===== PEREKAM OTOMATIS RUANG RAPAT =====================================

   Perangkat di ruang rapat (PC/mini PC/laptop yang tersambung mic Logitech)
   membuka halaman /perekam, dipasangkan ke satu ruangan dengan kode sekali
   pakai dari Admin, lalu merekam SEMUA rapat yang berjalan di ruangan itu.
   Setelah rapat selesai, rekaman otomatis dikirim ke antrean service AI.

   Keamanan: halaman /perekam tidak memakai login. Perangkat memegang token
   acak (disimpan hash-nya saja di DB) yang hanya bisa merekam rapat yang
   sedang berjalan di ruangannya sendiri. Admin bisa mencabutnya kapan saja.
   ====================================================================== */

const crypto = require("crypto");

const { query, getIsConnected } = require("../db");
const dashboardService = require("./dashboard.service");
const notulen = require("./notulen.service");

const { galat } = notulen;

// Rapat sering molor: rekaman diteruskan sampai sekian menit setelah jam selesai,
// kecuali sudah check-out atau rapat berikutnya di ruangan yang sama dimulai.
const MENIT_TAMBAHAN = Number(process.env.NOTULEN_REKAM_LEBIH_MENIT ?? 15);
const MENIT_KODE = 30;
const DETIK_ONLINE = 60;
const JEDA_OTOMATIS_MS = 60 * 1000;
const CACHE_RAPAT_MS = 30 * 1000;

const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

function samaRuang(a, b) {
  return String(a || "").toLowerCase().replace(/\s+/g, "") === String(b || "").toLowerCase().replace(/\s+/g, "");
}

function wajibDatabase() {
  if (!getIsConnected()) {
    throw galat("Perekam otomatis membutuhkan database PostgreSQL.", 503);
  }
}

/* ---------- jadwal rapat & jendela rekam ---------- */

let cacheRapat = { waktu: 0, data: [] };

/* getDashboardData menyinkronkan DB + Google Calendar, jadi hasilnya ditahan
   30 detik: perangkat melapor tiap 15 detik dan papan TV ikut bertanya. */
async function daftarRapat() {
  if (Date.now() - cacheRapat.waktu < CACHE_RAPAT_MS) return cacheRapat.data;
  let data;
  try {
    data = (await dashboardService.getDashboardData()).meetings || [];
  } catch {
    data = dashboardService.readStore().meetings || [];
  }
  cacheRapat = { waktu: Date.now(), data };
  return data;
}

function waktuRapat(m, jam) {
  const [y, mo, d] = String(m.date || "").split("-").map(Number);
  const [h, mi] = String(jam || "").split(":").map(Number);
  if (!y || !mo || !d || Number.isNaN(h)) return null;
  return dashboardService.waktuDiZona(y, mo, d, h || 0, mi || 0);
}

/* Rapat yang boleh direkam: sudah disetujui, tidak batal/ditolak, belum
   check-out. Statusnya dihitung dengan aturan yang sama dengan papan TV. */
function bolehDirekam(m) {
  const salinan = dashboardService.normalizeMeetingLifecycle({ ...m });
  return !["Menunggu Approval", "Ditolak", "Dibatalkan"].includes(salinan.status) && !m.checkOutAt;
}

/* Jendela rekam: [mulai, selesai + MENIT_TAMBAHAN), dipotong saat rapat
   berikutnya di ruangan yang sama dimulai. */
function jendelaRekam(m, semua) {
  const mulai = waktuRapat(m, m.start);
  const selesai = waktuRapat(m, m.end);
  if (!mulai || !selesai) return null;
  let akhir = new Date(selesai.getTime() + MENIT_TAMBAHAN * 60000);
  for (const lain of semua) {
    if (lain === m || String(lain.id) === String(m.id) || !samaRuang(lain.room, m.room) || lain.date !== m.date) continue;
    if (!bolehDirekam(lain)) continue;
    const mulaiLain = waktuRapat(lain, lain.start);
    if (mulaiLain && mulaiLain >= selesai && mulaiLain < akhir) akhir = mulaiLain;
  }
  return { mulai, selesai, akhir };
}

async function rapatBerjalanDi(ruang, now = new Date()) {
  const semua = await daftarRapat();
  const hariIni = dashboardService.formatDateISO(now);
  const kandidat = semua
    .filter((m) => samaRuang(m.room, ruang) && m.date === hariIni && bolehDirekam(m))
    .map((m) => ({ m, j: jendelaRekam(m, semua) }))
    .filter(({ j }) => j && now >= j.mulai && now < j.akhir)
    .sort((a, b) => a.j.mulai - b.j.mulai);
  // Bila dua jendela bertumpuk (rapat molor), rapat yang baru mulai yang menang.
  const pilih = kandidat[kandidat.length - 1];
  return pilih ? { meeting: pilih.m, jendela: pilih.j } : null;
}

/* ---------- pemasangan & autentikasi perangkat ---------- */

function kodeAcak() {
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa O/0/I/1 yang mirip
  return Array.from(crypto.randomBytes(8), (b) => huruf[b % huruf.length]).join("");
}

async function buatPerangkat({ roomName, label } = {}, oleh = "Admin") {
  wajibDatabase();
  const rooms = dashboardService.readStore().rooms || [];
  const ruang = rooms.find((r) => samaRuang(r.name, roomName));
  if (!ruang) throw galat("Ruangan tidak ditemukan.", 404);
  const id = `rcd_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const kode = kodeAcak();
  await query(
    `INSERT INTO room_recorders (id, room_name, label, pair_code_hash, pair_expires_at, created_by)
     VALUES ($1, $2, $3, $4, NOW() + make_interval(mins => $5::int), $6)`,
    [id, ruang.name, String(label || `Perekam ${ruang.name}`).slice(0, 150), hash(kode), String(MENIT_KODE), oleh],
  );
  return { id, kode, berlakuMenit: MENIT_KODE };
}

/* Kode baru untuk perangkat yang sama (mis. browser diganti). Token lama gugur. */
async function kodeUlang(id) {
  wajibDatabase();
  const kode = kodeAcak();
  const res = await query(
    `UPDATE room_recorders SET pair_code_hash = $2, pair_expires_at = NOW() + make_interval(mins => $3::int),
       token_hash = NULL, paired_at = NULL, revoked_at = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [String(id), hash(kode), String(MENIT_KODE)],
  );
  if (!res.rows[0]) throw galat("Perangkat tidak ditemukan.", 404);
  return { id, kode, berlakuMenit: MENIT_KODE };
}

async function cabutPerangkat(id) {
  wajibDatabase();
  const res = await query(
    `UPDATE room_recorders SET revoked_at = NOW(), token_hash = NULL, pair_code_hash = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [String(id)],
  );
  if (!res.rows[0]) throw galat("Perangkat tidak ditemukan.", 404);
  return true;
}

async function pasang(kode) {
  wajibDatabase();
  const bersih = String(kode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (bersih.length !== 8) throw galat("Kode pemasangan harus 8 karakter.");
  const res = await query(
    `SELECT * FROM room_recorders WHERE pair_code_hash = $1 AND revoked_at IS NULL`,
    [hash(bersih)],
  );
  const r = res.rows[0];
  if (!r) throw galat("Kode pemasangan salah atau sudah dipakai.", 404);
  if (new Date(r.pair_expires_at) < new Date()) throw galat("Kode pemasangan sudah kedaluwarsa. Minta kode baru ke Admin.", 410);
  const token = crypto.randomBytes(32).toString("base64url");
  await query(
    `UPDATE room_recorders SET token_hash = $2, pair_code_hash = NULL, pair_expires_at = NULL,
       paired_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [r.id, hash(token)],
  );
  return { token, ruang: r.room_name, label: r.label };
}

async function perangkatDariToken(token) {
  if (!token || !getIsConnected()) return null;
  const res = await query(
    "SELECT * FROM room_recorders WHERE token_hash = $1 AND revoked_at IS NULL",
    [hash(token)],
  );
  return res.rows[0] || null;
}

/* ---------- operasi perangkat ---------- */

/* Laporan berkala perangkat; jawabannya memberi tahu apakah harus merekam. */
async function detak(perangkat, status = {}) {
  const bersih = {
    state: String(status.state || "").slice(0, 30),
    micLabel: String(status.micLabel || "").slice(0, 150),
    error: String(status.error || "").slice(0, 300),
    fileId: status.fileId ? String(status.fileId).slice(0, 100) : null,
    meetingId: status.meetingId ? String(status.meetingId).slice(0, 100) : null,
    pending: Number(status.pending) || 0,
    userAgent: String(status.userAgent || "").slice(0, 200),
  };
  await query(
    "UPDATE room_recorders SET last_seen_at = NOW(), last_status = $2::jsonb, updated_at = NOW() WHERE id = $1",
    [perangkat.id, JSON.stringify(bersih)],
  );
  const aktif = await rapatBerjalanDi(perangkat.room_name);
  return {
    ruang: perangkat.room_name,
    label: perangkat.label,
    rekam: Boolean(aktif),
    rapat: aktif ? {
      id: aktif.meeting.id,
      title: aktif.meeting.title,
      date: aktif.meeting.date,
      start: aktif.meeting.start,
      end: aktif.meeting.end,
      sampai: aktif.jendela.akhir.toISOString(),
    } : null,
  };
}

async function mulaiRekam(perangkat, { meetingId, mimeType } = {}) {
  const aktif = await rapatBerjalanDi(perangkat.room_name);
  if (!aktif || String(aktif.meeting.id) !== String(meetingId)) {
    throw galat("Tidak ada rapat yang sedang berjalan di ruangan ini untuk direkam.", 409);
  }
  return notulen.mulaiSesiRekam(aktif.meeting.id, { mimeType }, `Perekam ${perangkat.room_name}`, perangkat.id);
}

async function fileMilik(perangkat, fileId) {
  const f = await notulen.ambilFileById(fileId);
  if (f.recorder_id !== perangkat.id) throw galat("File ini bukan milik perangkat ini.", 403);
  return f;
}

async function tambahPotongan(perangkat, fileId, seq, data) {
  const f = await fileMilik(perangkat, fileId);
  return notulen.tambahPotongan(f.meeting_id, f.id, seq, data);
}

async function selesaiRekam(perangkat, fileId) {
  const f = await fileMilik(perangkat, fileId);
  return notulen.selesaiRekam(f.meeting_id, f.id);
}

/* ---------- untuk Admin & papan TV ---------- */

function online(r) {
  return Boolean(r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < DETIK_ONLINE * 1000);
}

async function daftarPerangkat() {
  wajibDatabase();
  const res = await query("SELECT * FROM room_recorders WHERE revoked_at IS NULL ORDER BY room_name, created_at");
  const rooms = (dashboardService.readStore().rooms || []).map((r) => r.name);
  return {
    rooms,
    menitTambahan: MENIT_TAMBAHAN,
    perangkat: res.rows.map((r) => ({
      id: r.id,
      ruang: r.room_name,
      label: r.label,
      terpasang: Boolean(r.paired_at),
      kodeBerlakuSampai: r.pair_code_hash ? r.pair_expires_at : null,
      online: online(r),
      terakhirTerlihat: r.last_seen_at,
      status: r.last_status || {},
      dibuatOleh: r.created_by,
    })),
  };
}

/* Papan TV (publik): hanya ya/tidak per ruangan, tanpa detail lain. */
async function statusRuang() {
  if (!getIsConnected()) return {};
  const res = await query("SELECT room_name, last_seen_at, last_status FROM room_recorders WHERE revoked_at IS NULL AND paired_at IS NOT NULL");
  const hasil = {};
  for (const r of res.rows) {
    const merekam = online(r) && r.last_status?.state === "merekam";
    hasil[r.room_name] = Boolean(hasil[r.room_name] || merekam);
  }
  return hasil;
}

/* ---------- proses otomatis setelah rapat ---------- */

let sedangOtomatis = false;
const gagalTerakhir = new Map(); // meetingId → waktu log terakhir (agar log tidak banjir)

async function prosesOtomatisSekali() {
  if (sedangOtomatis || !getIsConnected()) return;
  sedangOtomatis = true;
  try {
    const res = await query(`
      SELECT f.meeting_id,
             BOOL_OR(f.status = 'merekam' AND f.updated_at > NOW() - INTERVAL '2 minutes') AS masih_mengirim
        FROM meeting_audio_files f
        LEFT JOIN meeting_minutes m ON m.meeting_id = f.meeting_id
       WHERE f.recorder_id IS NOT NULL AND f.size_bytes > 0
         AND (m.meeting_id IS NULL OR (m.status = 'DRAFT' AND m.auto_processed_at IS NULL))
       GROUP BY f.meeting_id`);
    for (const baris of res.rows) {
      if (baris.masih_mengirim) continue;
      const meeting = await dashboardService.getMeetingById(baris.meeting_id).catch(() => null);
      if (!meeting) continue;
      const semua = await daftarRapat();
      const j = jendelaRekam(meeting, semua);
      const selesai = meeting.checkOutAt || (j && new Date() >= j.selesai);
      if (!selesai) continue;
      const rooms = dashboardService.readStore().rooms || [];
      const ruangan = rooms.find((r) => samaRuang(r.name, meeting.room)) || null;
      try {
        await notulen.mulaiProses(meeting, ruangan, {}, "Otomatis (setelah rapat)");
        await query("UPDATE meeting_minutes SET auto_processed_at = NOW() WHERE meeting_id = $1", [String(meeting.id)]);
        console.log(`[Perekam] Rekaman rapat "${meeting.title}" dikirim ke antrean notulen.`);
        gagalTerakhir.delete(meeting.id);
      } catch (err) {
        // Service AI mati / RAM kurang: dicoba lagi di putaran berikutnya.
        const terakhir = gagalTerakhir.get(meeting.id) || 0;
        if (Date.now() - terakhir > 15 * 60 * 1000) {
          console.warn(`[Perekam] Proses otomatis "${meeting.title}" tertunda: ${err.message}`);
          gagalTerakhir.set(meeting.id, Date.now());
        }
      }
    }
  } catch (err) {
    console.warn("[Perekam] Gagal memeriksa rekaman untuk diproses:", err.message);
  } finally {
    sedangOtomatis = false;
  }
}

let timerOtomatis = null;
function mulaiProsesOtomatis() {
  if (timerOtomatis) return;
  timerOtomatis = setInterval(prosesOtomatisSekali, JEDA_OTOMATIS_MS);
  timerOtomatis.unref();
}

module.exports = {
  buatPerangkat,
  kodeUlang,
  cabutPerangkat,
  pasang,
  perangkatDariToken,
  detak,
  mulaiRekam,
  tambahPotongan,
  selesaiRekam,
  daftarPerangkat,
  statusRuang,
  mulaiProsesOtomatis,
  prosesOtomatisSekali,
  // diekspor untuk pengujian
  jendelaRekam,
  rapatBerjalanDi,
};
