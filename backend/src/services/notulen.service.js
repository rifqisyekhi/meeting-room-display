/* ===== NOTULEN OTOMATIS ================================================

   Rekaman/unggahan audio rapat → transkrip → draf notulen, diproses oleh
   service AI lokal (folder ai-service/, FastAPI di 127.0.0.1:8000).
   Audio rapat bersifat RAHASIA: tidak ada yang dikirim ke layanan cloud.

   Pembagian kerja:
   - Backend ini menyimpan file audio di NOTULEN_STORAGE_DIR, mencatatnya di
     tabel meeting_audio_files, lalu mengirim path absolutnya ke service AI.
     Service AI hanya mau membaca file di dalam folder yang sama
     (STORAGE_DIR di ai-service/.env), jadi kedua nilai harus sama.
   - Status job dipantau oleh pemantau latar belakang di bawah (bukan oleh
     browser), sehingga hasil tetap tersimpan walau halaman ditutup.
   - Fitur ini butuh PostgreSQL. Di mode fallback file JSON, semua rute
     notulen menolak dengan pesan jelas.
   ====================================================================== */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

const { query, getIsConnected } = require("../db");

const STORAGE_DIR = path.resolve(
  process.env.NOTULEN_STORAGE_DIR || path.join(__dirname, "../../data/notulen"),
);
const AI_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const AI_TOKEN = process.env.AI_SERVICE_TOKEN || "";
const MAKS_UNGGAH_BYTE = (Number(process.env.NOTULEN_MAX_UPLOAD_MB) || 2048) * 1024 * 1024;
const MAKS_POTONGAN_BYTE = 10 * 1024 * 1024;
const JEDA_PANTAU_MS = 3000;

const EKSTENSI_AUDIO = new Set([
  ".webm", ".ogg", ".oga", ".opus", ".mp3", ".m4a", ".mp4", ".aac", ".wav", ".flac", ".mkv",
]);

/* ---------- utilitas ---------- */

function galat(pesan, kode = 400) {
  const err = new Error(pesan);
  err.statusCode = kode;
  return err;
}

function wajibDatabase() {
  if (!getIsConnected()) {
    throw galat(
      "Fitur notulen membutuhkan database PostgreSQL. Backend sedang berjalan dalam mode file JSON.",
      503,
    );
  }
}

/* Nama folder per rapat. ID rapat bisa berupa ID Google Calendar yang berisi
   karakter apa saja, jadi disaring lalu diberi potongan hash agar unik. */
function folderRapat(meetingId) {
  const aman = String(meetingId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60);
  const hash = crypto.createHash("sha1").update(String(meetingId)).digest("hex").slice(0, 8);
  return `${aman}_${hash}`;
}

/* Satu-satunya pintu dari nama file di database ke path di disk. Menolak apa
   pun yang keluar dari STORAGE_DIR (path traversal). */
function pathAbsolut(fileName) {
  const abs = path.resolve(STORAGE_DIR, fileName);
  if (abs !== STORAGE_DIR && !abs.startsWith(STORAGE_DIR + path.sep)) {
    throw galat("Path file audio tidak valid.", 400);
  }
  return abs;
}

function ekstensiDariMime(mime = "") {
  const m = String(mime).toLowerCase();
  if (m.includes("webm")) return ".webm";
  if (m.includes("ogg")) return ".ogg";
  if (m.includes("mp4") || m.includes("aac")) return ".m4a";
  if (m.includes("wav")) return ".wav";
  if (m.includes("mpeg")) return ".mp3";
  return ".webm";
}

function barisFile(r) {
  return {
    id: r.id,
    kind: r.kind,
    originalName: r.original_name,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes) || 0,
    chunkCount: r.chunk_count,
    status: r.status,
    createdBy: r.created_by,
    recorderId: r.recorder_id || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function barisNotulen(r, { lengkap = true } = {}) {
  if (!r) return null;
  const hasil = {
    meetingId: r.meeting_id,
    status: r.status,
    jobType: r.job_type,
    stage: r.stage,
    stageLabel: r.stage_label,
    progress: r.progress,
    stageProgress: r.stage_progress,
    etaSeconds: r.eta_seconds,
    queuePosition: r.queue_position,
    error: r.error,
    minutesError: r.minutes_error,
    warnings: r.warnings || [],
    durationSeconds: r.duration_seconds,
    minutesReviewed: r.minutes_reviewed,
    minutesEditedBy: r.minutes_edited_by,
    minutesEditedAt: r.minutes_edited_at,
    whisperModel: r.whisper_model,
    llmModel: r.llm_model,
    diarization: r.diarization,
    startedBy: r.started_by,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    updatedAt: r.updated_at,
    // RAHASIA (bawaan) = hanya model lokal; BIASA = notulen boleh disusun Claude (cloud).
    classification: r.classification || "RAHASIA",
    classificationBy: r.classification_by,
    classificationAt: r.classification_at,
    hasTranscript: Array.isArray(r.transcript) && r.transcript.length > 0,
    // Transkrip proses yang sedang berjalan sudah tampil; notulen masih disusun.
    transcriptBaru: r.status === "PROCESSING" && Boolean(r.job_id) && r.transcript_job_id === r.job_id,
    hasMinutes: Boolean(r.minutes_md),
  };
  if (lengkap) {
    hasil.transcript = r.transcript || [];
    hasil.speakers = r.speakers || {};
    hasil.minutesMarkdown = r.minutes_md || "";
  }
  return hasil;
}

async function ambilBarisNotulen(meetingId) {
  const res = await query("SELECT * FROM meeting_minutes WHERE meeting_id = $1", [String(meetingId)]);
  return res.rows[0] || null;
}

async function pastikanBarisNotulen(meetingId) {
  await query(
    "INSERT INTO meeting_minutes (meeting_id) VALUES ($1) ON CONFLICT (meeting_id) DO NOTHING",
    [String(meetingId)],
  );
  return ambilBarisNotulen(meetingId);
}

/* ---------- klien service AI ---------- */

async function panggilAI(method, urlPath, body, timeoutMs = 15000) {
  const headers = { "Content-Type": "application/json" };
  if (AI_TOKEN) headers["X-API-Key"] = AI_TOKEN;
  let res;
  try {
    res = await fetch(`${AI_URL}${urlPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw galat(
      `Service AI tidak dapat dihubungi di ${AI_URL}. Pastikan service AI (ai-service) sedang berjalan.`,
      503,
    );
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const pesan = (data && (data.detail || data.error)) || `Service AI mengembalikan error ${res.status}.`;
    const err = galat(typeof pesan === "string" ? pesan : JSON.stringify(pesan), res.status === 404 ? 404 : 502);
    err.aiStatus = res.status;
    throw err;
  }
  return data;
}

/* Pilihan model untuk layar Proses. Daftar yang diizinkan diatur di
   ai-service/.env (WHISPER_ALLOWED_MODELS, OLLAMA_ALLOWED_MODELS). */
async function daftarModel() {
  return panggilAI("GET", "/models", undefined, 8000);
}

function teksModel(v) {
  const t = String(v || "").trim();
  return t ? t.slice(0, 200) : null;
}

async function statusServiceAI() {
  try {
    return { reachable: true, ...(await panggilAI("GET", "/health", undefined, 5000)) };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

/* ---------- file audio ---------- */

async function daftarFile(meetingId) {
  const res = await query(
    "SELECT * FROM meeting_audio_files WHERE meeting_id = $1 ORDER BY created_at, id",
    [String(meetingId)],
  );
  return res.rows;
}

async function ambilFile(meetingId, fileId) {
  const res = await query(
    "SELECT * FROM meeting_audio_files WHERE id = $1 AND meeting_id = $2",
    [String(fileId), String(meetingId)],
  );
  if (!res.rows[0]) throw galat("File audio tidak ditemukan.", 404);
  return res.rows[0];
}

/* Untuk perekam ruangan: cari file tanpa tahu ID rapatnya. */
async function ambilFileById(fileId) {
  const res = await query("SELECT * FROM meeting_audio_files WHERE id = $1", [String(fileId)]);
  if (!res.rows[0]) throw galat("File audio tidak ditemukan.", 404);
  return res.rows[0];
}

async function tolakJikaSedangDiproses(meetingId) {
  const baris = await ambilBarisNotulen(meetingId);
  if (baris && baris.status === "PROCESSING") {
    throw galat("Rapat ini sedang diproses. Tunggu sampai selesai atau batalkan prosesnya dulu.", 409);
  }
}

/* Sesi rekam baru = file baru. Setiap kali halaman dimuat ulang, perekam
   membuat sesi baru; saat diproses semua file dipakai berurutan. */
async function mulaiSesiRekam(meetingId, { mimeType } = {}, oleh = "Admin", recorderId = null) {
  wajibDatabase();
  const id = `rec_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const fileName = path.posix.join(folderRapat(meetingId), `${id}${ekstensiDariMime(mimeType)}`);
  await fsp.mkdir(path.dirname(pathAbsolut(fileName)), { recursive: true });
  await fsp.writeFile(pathAbsolut(fileName), Buffer.alloc(0), { flag: "wx" });
  const res = await query(
    `INSERT INTO meeting_audio_files (id, meeting_id, kind, original_name, file_name, mime_type, status, created_by, recorder_id)
     VALUES ($1, $2, 'rekaman', $3, $4, $5, 'merekam', $6, $7) RETURNING *`,
    [id, String(meetingId),
      `${recorderId ? "Rekaman otomatis" : "Rekaman"} ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
      fileName, String(mimeType || "audio/webm").slice(0, 100), oleh, recorderId],
  );
  await pastikanBarisNotulen(meetingId);
  return barisFile(res.rows[0]);
}

/* Potongan rekaman dikunci per file agar dua permintaan untuk file yang sama
   tidak menulis bersamaan. */
const kunciFile = new Map();
function denganKunci(kunci, fn) {
  const sebelum = kunciFile.get(kunci) || Promise.resolve();
  const berikut = sebelum.catch(() => {}).then(fn);
  kunciFile.set(kunci, berikut);
  berikut.finally(() => {
    if (kunciFile.get(kunci) === berikut) kunciFile.delete(kunci);
  }).catch(() => {});
  return berikut;
}

/* Idempoten: seq yang sudah tertulis diabaikan (respons sukses, supaya retry
   klien berhenti), seq yang meloncat ditolak dengan seq yang diharapkan.
   File dipotong dulu ke ukuran tercatat sebelum ditambah, jadi penulisan yang
   terputus di tengah jalan tidak meninggalkan byte ganda. */
async function tambahPotongan(meetingId, fileId, seq, data) {
  wajibDatabase();
  if (!Number.isInteger(seq) || seq < 0) throw galat("Nomor urut potongan tidak valid.");
  if (!Buffer.isBuffer(data) || data.length === 0) throw galat("Potongan rekaman kosong.");
  if (data.length > MAKS_POTONGAN_BYTE) throw galat("Potongan rekaman terlalu besar (maks. 10 MB).", 413);

  return denganKunci(fileId, async () => {
    const f = await ambilFile(meetingId, fileId);
    if (f.kind !== "rekaman") throw galat("File ini bukan sesi rekaman.");
    if (seq < f.chunk_count) {
      return { duplicate: true, nextSeq: f.chunk_count, file: barisFile(f) };
    }
    if (seq > f.chunk_count) {
      const err = galat(`Potongan meloncat: diharapkan nomor ${f.chunk_count}, diterima ${seq}.`, 409);
      err.expectedSeq = f.chunk_count;
      throw err;
    }
    const abs = pathAbsolut(f.file_name);
    await fsp.truncate(abs, Number(f.size_bytes));
    await fsp.appendFile(abs, data);
    const res = await query(
      `UPDATE meeting_audio_files
         SET chunk_count = chunk_count + 1, size_bytes = size_bytes + $1, status = 'merekam', updated_at = NOW()
       WHERE id = $2 AND chunk_count = $3 RETURNING *`,
      [data.length, f.id, seq],
    );
    if (!res.rows[0]) throw galat("Potongan bentrok dengan permintaan lain. Coba kirim ulang.", 409);
    return { duplicate: false, nextSeq: res.rows[0].chunk_count, file: barisFile(res.rows[0]) };
  });
}

async function selesaiRekam(meetingId, fileId) {
  wajibDatabase();
  const f = await ambilFile(meetingId, fileId);
  const res = await query(
    "UPDATE meeting_audio_files SET status = 'siap', updated_at = NOW() WHERE id = $1 RETURNING *",
    [f.id],
  );
  return barisFile(res.rows[0]);
}

/* Unggahan file besar (ratusan MB) dialirkan langsung ke disk, tidak
   ditampung di memori seperti express.raw. */
async function simpanUnggahan(meetingId, req, oleh = "Admin") {
  wajibDatabase();
  const decode = (v, cadangan) => {
    try { return decodeURIComponent(v || cadangan); } catch { return cadangan; }
  };
  const namaAsli = path.basename(decode(req.get("X-File-Name"), "audio")).slice(0, 255);
  const ext = path.extname(namaAsli).toLowerCase();
  if (!EKSTENSI_AUDIO.has(ext)) {
    throw galat(`Format file "${ext || "?"}" tidak didukung. Gunakan mp3, m4a, wav, webm, ogg, atau sejenisnya.`, 415);
  }
  const panjang = Number(req.get("Content-Length") || 0);
  if (panjang > MAKS_UNGGAH_BYTE) {
    throw galat(`Ukuran file melebihi batas ${Math.round(MAKS_UNGGAH_BYTE / 1024 / 1024)} MB.`, 413);
  }

  const id = `upl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const fileName = path.posix.join(folderRapat(meetingId), `${id}${ext}`);
  const abs = pathAbsolut(fileName);
  await fsp.mkdir(path.dirname(abs), { recursive: true });

  let diterima = 0;
  req.on("data", (chunk) => {
    diterima += chunk.length;
    if (diterima > MAKS_UNGGAH_BYTE) {
      req.destroy(galat(`Ukuran file melebihi batas ${Math.round(MAKS_UNGGAH_BYTE / 1024 / 1024)} MB.`, 413));
    }
  });
  try {
    await pipeline(req, fs.createWriteStream(abs, { flags: "wx" }));
  } catch (err) {
    await fsp.unlink(abs).catch(() => {});
    if (err.statusCode) throw err;
    throw galat("Unggahan terputus sebelum selesai. Silakan unggah ulang.", 400);
  }
  if (diterima === 0) {
    await fsp.unlink(abs).catch(() => {});
    throw galat("File kosong atau tidak terbaca.");
  }

  const res = await query(
    `INSERT INTO meeting_audio_files (id, meeting_id, kind, original_name, file_name, mime_type, size_bytes, status, created_by)
     VALUES ($1, $2, 'unggahan', $3, $4, $5, $6, 'siap', $7) RETURNING *`,
    [id, String(meetingId), namaAsli, fileName, String(req.get("X-File-Type") || "").slice(0, 100) || null, diterima, oleh],
  );
  await pastikanBarisNotulen(meetingId);
  return barisFile(res.rows[0]);
}

async function hapusFile(meetingId, fileId) {
  wajibDatabase();
  await tolakJikaSedangDiproses(meetingId);
  const f = await ambilFile(meetingId, fileId);
  await query("DELETE FROM meeting_audio_files WHERE id = $1", [f.id]);
  await fsp.unlink(pathAbsolut(f.file_name)).catch(() => {});
  return true;
}

/* Hapus transkrip & notulen; file audio tidak disentuh. Barisnya dikosongkan
   (bukan dihapus) agar penanda auto_processed_at tetap ada, sehingga rekaman
   perekam otomatis tidak diproses ulang sendiri. */
async function hapusHasil(meetingId) {
  wajibDatabase();
  await tolakJikaSedangDiproses(meetingId);
  await query(
    `UPDATE meeting_minutes SET status = 'DRAFT', job_id = NULL, job_type = NULL, stage = NULL, stage_label = NULL,
       progress = 0, stage_progress = 0, eta_seconds = NULL, queue_position = NULL, error = NULL,
       minutes_error = NULL, warnings = '[]'::jsonb, transcript = NULL, speakers = '{}'::jsonb,
       duration_seconds = NULL, minutes_md = NULL, minutes_reviewed = FALSE, minutes_edited_by = NULL,
       minutes_edited_at = NULL, whisper_model = NULL, llm_model = NULL, diarization = FALSE,
       started_by = NULL, started_at = NULL, finished_at = NULL, updated_at = NOW()
     WHERE meeting_id = $1`,
    [String(meetingId)],
  );
  return true;
}

async function pathFileUntukDiputar(meetingId, fileId) {
  wajibDatabase();
  const f = await ambilFile(meetingId, fileId);
  return { abs: pathAbsolut(f.file_name), file: f };
}

/* Dipanggil saat rapat dihapus: audio rahasia tidak boleh tertinggal. */
async function hapusDataNotulen(meetingId) {
  if (!getIsConnected()) return;
  const files = await daftarFile(meetingId);
  const baris = await ambilBarisNotulen(meetingId);
  if (baris && baris.status === "PROCESSING" && baris.job_id) {
    await panggilAI("POST", `/jobs/${baris.job_id}/cancel`).catch(() => {});
  }
  await query("DELETE FROM meeting_audio_files WHERE meeting_id = $1", [String(meetingId)]);
  await query("DELETE FROM meeting_minutes WHERE meeting_id = $1", [String(meetingId)]);
  await fsp.rm(path.join(STORAGE_DIR, folderRapat(meetingId)), { recursive: true, force: true });
  return files.length;
}

/* ---------- pemrosesan ---------- */

/* Metadata rapat untuk notulen. Peserta diambil dari daftar hadir (presensi)
   bila sudah ada, karena tabel meetings hanya menyimpan JUMLAH peserta. */
function metadataRapat(meeting, ruangan) {
  const nama = (Array.isArray(meeting.attendees) ? meeting.attendees : [])
    .map((a) => (typeof a === "string" ? a : a && a.name))
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter((s, i, arr) => s && arr.indexOf(s) === i)
    .slice(0, 100);
  const tempat = [meeting.room || meeting.roomName, ruangan && ruangan.location].filter(Boolean).join(", ");
  return {
    title: meeting.title || "Rapat",
    datetime: meeting.date ? `${meeting.date}T${meeting.start || "00:00"}:00` : null,
    datetime_display: meeting.date
      ? `${formatTanggal(meeting.date)}, pukul ${(meeting.start || "").replace(":", ".")}–${(meeting.end || "").replace(":", ".")} WIB`
      : null,
    location: tempat || null,
    participants: nama,
    // Hanya field agenda: desc berisi deskripsi Google Calendar ("Ruang: ..."), bukan agenda.
    agenda: meeting.agenda || null,
  };
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"];
function formatTanggal(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${hari}, ${d} ${BULAN[m - 1]} ${y}`;
}

const KLASIFIKASI = ["RAHASIA", "BIASA"];

function modelCloud(nama) {
  return /^claude-/i.test(String(nama || ""));
}

/* Claude memproses teks di luar server instansi: hanya untuk rapat yang oleh admin
   diklasifikasikan BIASA. Mengembalikan opsi izin untuk service AI (yang juga mengecek). */
async function izinModelNotulen(meetingId, llmModel) {
  if (!modelCloud(llmModel)) return {};
  const baris = await ambilBarisNotulen(meetingId);
  if ((baris && baris.classification) !== "BIASA") {
    throw galat("Rapat ini berklasifikasi Rahasia/Penting, jadi notulen hanya boleh disusun dengan model lokal. "
      + "Ubah klasifikasi ke Biasa bila rapat ini memang boleh memakai Claude (cloud).", 403);
  }
  return { allow_cloud: true };
}

async function aturKlasifikasi(meetingId, nilai, oleh = "Admin") {
  wajibDatabase();
  const k = String(nilai || "").toUpperCase();
  if (!KLASIFIKASI.includes(k)) throw galat("Klasifikasi harus RAHASIA atau BIASA.");
  await tolakJikaSedangDiproses(meetingId);
  await pastikanBarisNotulen(meetingId);
  await query(
    `UPDATE meeting_minutes SET classification = $2, classification_by = $3, classification_at = NOW(),
       updated_at = NOW() WHERE meeting_id = $1`,
    [String(meetingId), k, oleh],
  );
  return barisNotulen(await ambilBarisNotulen(meetingId), { lengkap: false });
}

async function mulaiProses(meeting, ruangan, opsi = {}, oleh = "Admin") {
  wajibDatabase();
  await tolakJikaSedangDiproses(meeting.id);
  const izinCloud = await izinModelNotulen(meeting.id, teksModel(opsi.llmModel));
  const files = (await daftarFile(meeting.id)).filter((f) => Number(f.size_bytes) > 0);
  if (!files.length) throw galat("Belum ada file audio untuk rapat ini. Rekam atau unggah audio terlebih dulu.");

  const numSpeakers = Number(opsi.numSpeakers) || null;
  const body = {
    type: "transcribe",
    audio_files: files.map((f) => pathAbsolut(f.file_name)),
    meeting: metadataRapat(meeting, ruangan),
    options: {
      ...(opsi.diarization === false ? { diarization: false } : {}),
      ...(numSpeakers ? { num_speakers: Math.min(50, Math.max(1, numSpeakers)) } : {}),
      summarize: opsi.summarize !== false,
      ...(teksModel(opsi.whisperModel) ? { whisper_model: teksModel(opsi.whisperModel) } : {}),
      ...(teksModel(opsi.llmModel) ? { llm_model: teksModel(opsi.llmModel) } : {}),
      ...izinCloud,
    },
  };
  const job = await panggilAI("POST", "/jobs", body);
  await pastikanBarisNotulen(meeting.id);
  await query(
    `UPDATE meeting_minutes SET status = 'PROCESSING', job_id = $2, job_type = 'transcribe', stage = NULL,
       stage_label = 'Menunggu antrean', progress = 0, stage_progress = 0, eta_seconds = NULL,
       queue_position = $3, error = NULL, minutes_error = NULL, warnings = '[]'::jsonb,
       started_by = $4, started_at = NOW(), finished_at = NULL, updated_at = NOW()
     WHERE meeting_id = $1`,
    [String(meeting.id), job.id, job.queue_position, oleh],
  );
  return barisNotulen(await ambilBarisNotulen(meeting.id), { lengkap: false });
}

/* Buat ulang notulen dari transkrip yang sudah ada, memakai nama pembicara
   yang diisi admin (SPEAKER_1 → "Pak Budi"). */
async function buatUlangNotulen(meeting, ruangan, opsi = {}, oleh = "Admin") {
  wajibDatabase();
  await tolakJikaSedangDiproses(meeting.id);
  const baris = await ambilBarisNotulen(meeting.id);
  if (!baris || !Array.isArray(baris.transcript) || !baris.transcript.length) {
    throw galat("Transkrip belum ada. Proses audio terlebih dulu.");
  }
  const izinCloud = await izinModelNotulen(meeting.id, teksModel(opsi.llmModel));
  const job = await panggilAI("POST", "/jobs", {
    type: "summarize",
    segments: baris.transcript.map((s) => ({ start: s.start, end: s.end, speaker: s.speaker || null, text: s.text || "" })),
    speaker_names: baris.speakers || {},
    meeting: metadataRapat(meeting, ruangan),
    options: teksModel(opsi.llmModel) ? { llm_model: teksModel(opsi.llmModel), ...izinCloud } : {},
  }, 60000);
  await query(
    `UPDATE meeting_minutes SET status = 'PROCESSING', job_id = $2, job_type = 'summarize', stage = NULL,
       stage_label = 'Menunggu antrean', progress = 0, stage_progress = 0, eta_seconds = NULL,
       queue_position = $3, error = NULL, minutes_error = NULL, started_by = $4, started_at = NOW(),
       finished_at = NULL, updated_at = NOW()
     WHERE meeting_id = $1`,
    [String(meeting.id), job.id, job.queue_position, oleh],
  );
  return barisNotulen(await ambilBarisNotulen(meeting.id), { lengkap: false });
}

async function batalkanProses(meetingId) {
  wajibDatabase();
  const baris = await ambilBarisNotulen(meetingId);
  if (!baris || baris.status !== "PROCESSING" || !baris.job_id) {
    throw galat("Tidak ada proses yang sedang berjalan untuk rapat ini.", 409);
  }
  try {
    await panggilAI("POST", `/jobs/${baris.job_id}/cancel`);
  } catch (err) {
    if (err.aiStatus !== 404) throw err;
  }
  // Status akhir (CANCELLED → kembali ke status sebelumnya) dicatat oleh pemantau.
  return true;
}

async function simpanNamaPembicara(meetingId, speakers) {
  wajibDatabase();
  const bersih = {};
  for (const [label, nama] of Object.entries(speakers || {})) {
    const l = String(label).trim().slice(0, 40);
    const n = String(nama || "").trim().slice(0, 100);
    if (l && n) bersih[l] = n;
  }
  const baris = await pastikanBarisNotulen(meetingId);
  await query(
    "UPDATE meeting_minutes SET speakers = $2::jsonb, updated_at = NOW() WHERE meeting_id = $1",
    [baris.meeting_id, JSON.stringify(bersih)],
  );
  return bersih;
}

async function simpanNotulen(meetingId, { markdown, reviewed }, oleh = "Admin") {
  wajibDatabase();
  await tolakJikaSedangDiproses(meetingId);
  if (typeof markdown !== "string") throw galat("Isi notulen tidak valid.");
  if (markdown.length > 2_000_000) throw galat("Isi notulen terlalu panjang.", 413);
  const baris = await pastikanBarisNotulen(meetingId);
  await query(
    `UPDATE meeting_minutes SET minutes_md = $2, minutes_reviewed = $3, minutes_edited_by = $4,
       minutes_edited_at = NOW(), updated_at = NOW() WHERE meeting_id = $1`,
    [baris.meeting_id, markdown, Boolean(reviewed), oleh],
  );
  return barisNotulen(await ambilBarisNotulen(meetingId));
}

async function ringkasan(meetingId) {
  wajibDatabase();
  const [files, baris] = await Promise.all([daftarFile(meetingId), ambilBarisNotulen(meetingId)]);
  return { files: files.map(barisFile), minutes: barisNotulen(baris) };
}

async function statusRingan(meetingId) {
  wajibDatabase();
  return barisNotulen(await ambilBarisNotulen(meetingId), { lengkap: false });
}

async function ambilMarkdown(meetingId) {
  wajibDatabase();
  const baris = await ambilBarisNotulen(meetingId);
  if (!baris || !baris.minutes_md) throw galat("Notulen belum tersedia.", 404);
  return baris.minutes_md;
}

/* ---------- pemantau job latar belakang ---------- */

async function catatHasil(baris, job) {
  const r = job.result || {};
  if (baris.job_type === "summarize") {
    await query(
      `UPDATE meeting_minutes SET status = 'DONE', job_id = NULL, stage = NULL, stage_label = NULL,
         progress = 1, eta_seconds = NULL, queue_position = NULL, error = NULL, minutes_error = NULL,
         minutes_md = $2, minutes_reviewed = FALSE, minutes_edited_by = NULL, minutes_edited_at = NULL,
         llm_model = $3, warnings = $4::jsonb, finished_at = NOW(), updated_at = NOW()
       WHERE meeting_id = $1`,
      [baris.meeting_id, r.minutes_markdown || "", r.llm_model || null, JSON.stringify(job.warnings || [])],
    );
    return;
  }
  const t = r.transcript || {};
  await query(
    `UPDATE meeting_minutes SET status = 'DONE', job_id = NULL, stage = NULL, stage_label = NULL,
       progress = 1, eta_seconds = NULL, queue_position = NULL, error = NULL,
       minutes_error = $2, transcript = $3::jsonb, speakers = '{}'::jsonb, duration_seconds = $4,
       minutes_md = COALESCE($5::text, minutes_md),
       minutes_reviewed = CASE WHEN $5::text IS NULL THEN minutes_reviewed ELSE FALSE END,
       minutes_edited_by = CASE WHEN $5::text IS NULL THEN minutes_edited_by ELSE NULL END,
       minutes_edited_at = CASE WHEN $5::text IS NULL THEN minutes_edited_at ELSE NULL END,
       whisper_model = $6, llm_model = $7, diarization = $8, warnings = $9::jsonb,
       finished_at = NOW(), updated_at = NOW()
     WHERE meeting_id = $1`,
    [
      baris.meeting_id,
      r.minutes_error || null,
      JSON.stringify(t.segments || []),
      t.duration_seconds || null,
      r.minutes_markdown || null,
      t.whisper_model || null,
      r.llm_model || null,
      Boolean(t.diarization),
      JSON.stringify(job.warnings || []),
    ],
  );
}

/* Job gagal/dibatalkan. Transkrip & notulen sebelumnya tidak disentuh, jadi
   rapat yang sudah pernah selesai tetap punya hasil lama. */
async function catatGagal(baris, pesan, dibatalkan = false) {
  const punyaHasil = (Array.isArray(baris.transcript) && baris.transcript.length) || baris.minutes_md;
  const status = dibatalkan ? (punyaHasil ? "DONE" : "DRAFT") : "FAILED";
  await query(
    `UPDATE meeting_minutes SET status = $2, job_id = NULL, stage = NULL, stage_label = NULL, eta_seconds = NULL,
       queue_position = NULL, error = $3, finished_at = NOW(), updated_at = NOW()
     WHERE meeting_id = $1`,
    [baris.meeting_id, status, dibatalkan ? null : pesan],
  );
}

/* Tahap transkripsi selesai, notulen masih disusun: tampilkan transkripnya lebih dulu.
   Hasil akhir (catatHasil) tetap menimpa kolom yang sama saat job selesai. */
async function simpanTranskripAwal(baris) {
  const t = await panggilAI("GET", `/jobs/${baris.job_id}/transcript`, undefined, 60000);
  await query(
    `UPDATE meeting_minutes SET transcript = $2::jsonb, speakers = '{}'::jsonb, duration_seconds = $3,
       whisper_model = $4, diarization = $5, transcript_job_id = $6, updated_at = NOW()
     WHERE meeting_id = $1 AND job_id = $6`,
    [baris.meeting_id, JSON.stringify(t.segments || []), t.duration_seconds || null,
      t.whisper_model || null, Boolean(t.diarization), baris.job_id],
  );
}

let sedangMemantau = false;
async function pantauSekali() {
  if (sedangMemantau || !getIsConnected()) return;
  sedangMemantau = true;
  try {
    const res = await query("SELECT * FROM meeting_minutes WHERE status = 'PROCESSING' AND job_id IS NOT NULL");
    for (const baris of res.rows) {
      let job;
      try {
        job = await panggilAI("GET", `/jobs/${baris.job_id}?include_result=false`, undefined, 10000);
      } catch (err) {
        if (err.aiStatus === 404) {
          await catatGagal(baris, "Job tidak ditemukan di service AI (data job hilang). Silakan proses ulang.");
        }
        // Service AI mati sementara: biarkan, coba lagi di putaran berikutnya.
        continue;
      }
      if (job.status === "done") {
        const lengkap = await panggilAI("GET", `/jobs/${baris.job_id}`, undefined, 60000);
        await catatHasil(baris, lengkap);
        await panggilAI("DELETE", `/jobs/${baris.job_id}`).catch(() => {});
      } else if (job.status === "failed") {
        await catatGagal(baris, job.error || "Pemrosesan gagal.");
        await panggilAI("DELETE", `/jobs/${baris.job_id}`).catch(() => {});
      } else if (job.status === "cancelled") {
        await catatGagal(baris, null, true);
        await panggilAI("DELETE", `/jobs/${baris.job_id}`).catch(() => {});
      } else {
        if (job.transcript_ready && baris.job_type !== "summarize" && baris.transcript_job_id !== baris.job_id) {
          await simpanTranskripAwal(baris).catch((err) => console.warn("[Notulen] Gagal mengambil transkrip awal:", err.message));
        }
        await query(
          `UPDATE meeting_minutes SET stage = $2, stage_label = $3, progress = $4, stage_progress = $5,
             eta_seconds = $6, queue_position = $7, warnings = $8::jsonb, updated_at = NOW()
           WHERE meeting_id = $1 AND job_id = $9`,
          [baris.meeting_id, job.stage, job.status === "queued" ? "Menunggu antrean" : job.stage_label,
            job.progress, job.stage_progress, job.eta_seconds, job.queue_position,
            JSON.stringify(job.warnings || []), baris.job_id],
        );
      }
    }
  } catch (err) {
    console.warn("[Notulen] Gagal memantau job:", err.message);
  } finally {
    sedangMemantau = false;
  }
}

let timerPantau = null;
function mulaiPemantauJob() {
  if (timerPantau) return;
  timerPantau = setInterval(pantauSekali, JEDA_PANTAU_MS);
  timerPantau.unref();
}

module.exports = {
  STORAGE_DIR,
  galat,
  statusServiceAI,
  daftarModel,
  mulaiSesiRekam,
  ambilFileById,
  tambahPotongan,
  selesaiRekam,
  simpanUnggahan,
  hapusFile,
  pathFileUntukDiputar,
  hapusDataNotulen,
  mulaiProses,
  buatUlangNotulen,
  batalkanProses,
  hapusHasil,
  aturKlasifikasi,
  simpanNamaPembicara,
  simpanNotulen,
  ringkasan,
  statusRingan,
  ambilMarkdown,
  mulaiPemantauJob,
  pantauSekali,
};
