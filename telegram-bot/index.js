#!/usr/bin/env node
/* ===== BOT TELEGRAM SisKA — penawar notulen ============================

   Kenapa bot ini berjalan di PC, bukan di VPS:
   jaringan internal tidak meloloskan api.telegram.org. Diuji 2 Nov 2026 dari
   192.168.223.207 — google.com 200 dalam 0,14 s, api.telegram.org timeout
   20 s, TCP 443 ke IP hasil DNS-nya (149.154.166.110) tidak tersambung.
   PC operator bisa menjangkau Telegram sekaligus backend lewat LAN, jadi
   botnya di sini dan tidak ada setelan firewall yang perlu diubah.

   Alurnya:
   1. Tanya backend: ada rapat BIASA yang transkripnya siap tapi notulennya
      belum ada?
   2. Kirim ke Telegram: judul, tanggal, ruang + tombol Ya/Tidak.
      HANYA itu. Isi transkrip tidak pernah keluar ke server Telegram.
   3. "Tidak"  -> suruh backend pakai model lokal (gemma3 di VPS).
      "Ya"     -> tulis berkas tugas ke folder antrian; penyusun notulen
                  (sesi Claude Code terjadwal) yang mengambilnya dari situ,
                  membaca transkrip langsung dari LAN, lalu menyimpannya.

   Bot ini sengaja TIDAK bisa menyusun notulen sendiri. Ia hanya penawar dan
   pencatat jawaban, supaya satu proses yang jalan 24 jam tidak perlu
   menyimpan kunci API apa pun.
*/

const fs = require("fs");
const path = require("path");

/* ---------- konfigurasi ---------- */

function muatEnv(berkas) {
  if (!fs.existsSync(berkas)) return;
  for (const baris of fs.readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const nilai = m[2].trim().replace(/^["'](.*)["']$/, "$1");
    if (process.env[m[1]] === undefined) process.env[m[1]] = nilai;
  }
}
muatEnv(path.join(__dirname, ".env"));

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API_BASE = (process.env.BACKEND_URL || "http://192.168.223.207").replace(/\/+$/, "");
const API_TOKEN = process.env.BOT_TELEGRAM_API_TOKEN || "";
const DIR_ANTRIAN = process.env.QUEUE_DIR || path.join(__dirname, "antrian");
const DIR_SELESAI = path.join(DIR_ANTRIAN, "selesai");
const BERKAS_STATE = path.join(__dirname, "state.json");
const JEDA_CEK_MS = Number(process.env.POLL_BACKEND_SECONDS || 120) * 1000;
const MODEL_LOKAL = process.env.LOCAL_LLM_MODEL || "";

/* Hanya chat dalam daftar ini yang dilayani. Tanpa ini, siapa pun yang
   menemukan @siskarokeubot bisa menyetujui notulen rapat. */
const CHAT_DIIZINKAN = (process.env.ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function wajibAda(nama, nilai) {
  if (!nilai) {
    console.error(`[SisKA] ${nama} belum diisi di telegram-bot/.env — bot berhenti.`);
    process.exit(1);
  }
}
wajibAda("TELEGRAM_BOT_TOKEN", TOKEN);
wajibAda("BOT_TELEGRAM_API_TOKEN", API_TOKEN);
if (!CHAT_DIIZINKAN.length) {
  console.error(
    "[SisKA] ALLOWED_CHAT_IDS kosong — bot berhenti. Tanpa daftar izin, siapa pun\n" +
      "        yang menemukan bot ini bisa menyetujui notulen rapat.",
  );
  process.exit(1);
}

for (const d of [DIR_ANTRIAN, DIR_SELESAI]) fs.mkdirSync(d, { recursive: true });

/* ---------- state: rapat yang sudah pernah ditawarkan ---------- */

function bacaState() {
  try {
    return JSON.parse(fs.readFileSync(BERKAS_STATE, "utf8"));
  } catch {
    return { offset: 0, ditawarkan: {} };
  }
}
function tulisState(s) {
  fs.writeFileSync(BERKAS_STATE, JSON.stringify(s, null, 2));
}
let state = bacaState();

/* ---------- Telegram ---------- */

async function tele(metode, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(70000),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok && metode !== "getUpdates") {
    // Pesan galat Telegram memuat deskripsi yang berguna; token tidak ikut.
    throw new Error(`Telegram ${metode}: ${j.description || r.status}`);
  }
  return j;
}

function escMd(t) {
  return String(t == null ? "" : t).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/* ---------- backend (LAN) ---------- */

async function backend(metode, jalur, body) {
  const r = await fetch(`${API_BASE}/api/bot-telegram${jalur}`, {
    method: metode,
    headers: { "Content-Type": "application/json", "x-bot-token": API_TOKEN },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) {
    throw new Error(j.error || `Backend ${r.status} pada ${jalur}`);
  }
  return j;
}

/* ---------- menawarkan rapat ---------- */

function teksTawaran(r) {
  const jam = r.start && r.end ? `${r.start}–${r.end}` : r.start || "-";
  return [
    "📝 *Transkrip rapat selesai*",
    "",
    `*${escMd(r.title)}*`,
    `Tanggal: ${escMd(r.date || "-")}, ${escMd(jam)} WIB`,
    `Ruang: ${escMd(r.room || "-")}`,
    `Klasifikasi: *BIASA*`,
    `Panjang transkrip: ${r.segments} segmen`,
    "",
    "Susun notulen pakai Claude?",
    "",
    "_Tidak = pakai model lokal di server \\(gemma3\\)._",
  ].join("\n");
}

async function tawarkan(r) {
  for (const chatId of CHAT_DIIZINKAN) {
    const j = await tele("sendMessage", {
      chat_id: chatId,
      text: teksTawaran(r),
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Ya, pakai Claude", callback_data: `ya:${r.meetingId}` },
            { text: "🖥 Tidak, model lokal", callback_data: `no:${r.meetingId}` },
          ],
        ],
      },
    });
    console.log(`[SisKA] ditawarkan "${r.title}" ke chat ${chatId} (msg ${j.result.message_id})`);
  }
  state.ditawarkan[r.meetingId] = { pada: new Date().toISOString(), judul: r.title };
  tulisState(state);
}

async function cekAntrianBackend() {
  let j;
  try {
    j = await backend("GET", "/antrian");
  } catch (e) {
    console.warn("[SisKA] gagal membaca antrian backend:", e.message);
    return;
  }
  for (const r of j.antrian || []) {
    if (state.ditawarkan[r.meetingId]) continue;
    try {
      await tawarkan(r);
    } catch (e) {
      console.warn(`[SisKA] gagal menawarkan ${r.meetingId}:`, e.message);
    }
  }
}

/* ---------- menanggapi tombol ---------- */

async function jawabTombol(cq) {
  const chatId = String(cq.message?.chat?.id || "");
  if (!CHAT_DIIZINKAN.includes(chatId)) {
    await tele("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Chat ini tidak berizin.",
      show_alert: true,
    });
    console.warn(`[SisKA] tombol ditekan dari chat tak berizin: ${chatId}`);
    return;
  }

  const [aksi, meetingId] = String(cq.data || "").split(":");
  const judul = state.ditawarkan[meetingId]?.judul || meetingId;

  if (aksi === "uji") {
    await tele("answerCallbackQuery", { callback_query_id: cq.id, text: "Uji diterima." });
    await tele("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: cq.message.message_id,
      reply_markup: { inline_keyboard: [] },
    });
    await tele("sendMessage", {
      chat_id: chatId,
      text:
        meetingId === "ya"
          ? "✅ Uji berhasil: jalur *Ya* tersambung."
          : "🖥 Uji berhasil: jalur *Tidak* tersambung.",
      parse_mode: "Markdown",
    });
    return;
  }

  if (!meetingId || !["ya", "no"].includes(aksi)) {
    await tele("answerCallbackQuery", { callback_query_id: cq.id, text: "Perintah tidak dikenal." });
    return;
  }

  try {
    if (aksi === "no") {
      await backend("POST", `/meetings/${encodeURIComponent(meetingId)}/lokal`,
        MODEL_LOKAL ? { llmModel: MODEL_LOKAL } : {});
      await tele("answerCallbackQuery", { callback_query_id: cq.id, text: "Model lokal dijalankan." });
      await selesaikanPesan(chatId, cq.message.message_id,
        `🖥 *${escMd(judul)}*\n\nDiproses model lokal di server\\. Hasilnya muncul di Manajemen Rapat\\.`);
    } else {
      const tugas = {
        meetingId,
        judul,
        dimintaOleh: chatId,
        messageId: cq.message.message_id,
        dimintaPada: new Date().toISOString(),
      };
      fs.writeFileSync(
        path.join(DIR_ANTRIAN, `${meetingId}.json`),
        JSON.stringify(tugas, null, 2),
      );
      await tele("answerCallbackQuery", { callback_query_id: cq.id, text: "Masuk antrian Claude." });
      await selesaikanPesan(chatId, cq.message.message_id,
        `✅ *${escMd(judul)}*\n\nMasuk antrian Claude\\. Anda akan dikabari di sini kalau notulennya sudah jadi\\.`);
      console.log(`[SisKA] antrian Claude: ${meetingId}`);
    }
  } catch (e) {
    await tele("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: `Gagal: ${e.message}`.slice(0, 190),
      show_alert: true,
    });
    console.warn(`[SisKA] gagal memproses ${aksi} untuk ${meetingId}:`, e.message);
  }
}

/* Hapus tombol lalu ganti teksnya, supaya tidak bisa ditekan dua kali. */
async function selesaikanPesan(chatId, messageId, teks) {
  await tele("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: teks,
    parse_mode: "MarkdownV2",
  }).catch(() => {});
}

/* ---------- kabar balik dari penyusun notulen ---------- */

/* Penyusun notulen menaruh berkas hasil di antrian/selesai/<id>.json berisi
   { meetingId, chatId, messageId, ok, pesan }. Bot yang mengabarkan, bukan
   penyusunnya, supaya token Telegram cukup dipegang satu proses. */
async function kirimKabarSelesai() {
  for (const nama of fs.readdirSync(DIR_SELESAI).filter((n) => n.endsWith(".json"))) {
    const berkas = path.join(DIR_SELESAI, nama);
    let k;
    try {
      k = JSON.parse(fs.readFileSync(berkas, "utf8"));
    } catch {
      fs.renameSync(berkas, `${berkas}.rusak`);
      continue;
    }
    const chatId = String(k.chatId || CHAT_DIIZINKAN[0]);
    if (!CHAT_DIIZINKAN.includes(chatId)) {
      fs.unlinkSync(berkas);
      continue;
    }
    const teks = k.ok
      ? `✅ *Notulen siap*\n\n${escMd(k.judul || k.meetingId)}\n\n${escMd(k.pesan || "Sudah tersimpan di Manajemen Rapat.")}`
      : `⚠️ *Gagal menyusun notulen*\n\n${escMd(k.judul || k.meetingId)}\n\n${escMd(k.pesan || "Coba jalankan model lokal.")}`;
    try {
      await tele("sendMessage", { chat_id: chatId, text: teks, parse_mode: "MarkdownV2" });
      fs.unlinkSync(berkas);
      console.log(`[SisKA] kabar terkirim untuk ${k.meetingId}`);
    } catch (e) {
      console.warn(`[SisKA] gagal mengabarkan ${k.meetingId}:`, e.message);
    }
  }
}

/* ---------- perintah teks ---------- */

async function jawabPesan(msg) {
  const chatId = String(msg.chat?.id || "");
  const teks = (msg.text || "").trim();
  if (!CHAT_DIIZINKAN.includes(chatId)) {
    console.warn(`[SisKA] pesan dari chat tak berizin ${chatId}: ${teks.slice(0, 40)}`);
    await tele("sendMessage", {
      chat_id: chatId,
      text: "Bot ini hanya untuk operator notulen Biro Keuangan dan BMN.",
    }).catch(() => {});
    return;
  }
  if (teks === "/start" || teks === "/help") {
    await tele("sendMessage", {
      chat_id: chatId,
      text:
        "Bot SisKA — penawar notulen.\n\n" +
        "Saya mengabari Anda tiap ada rapat *Biasa* yang transkripnya sudah selesai, " +
        "lalu Anda pilih:\n" +
        "• *Ya* — notulen disusun Claude\n" +
        "• *Tidak* — notulen disusun model lokal di server\n\n" +
        "Perintah:\n" +
        "/antrian — lihat rapat yang menunggu dijawab\n" +
        "/status — kondisi bot",
      parse_mode: "Markdown",
    });
    return;
  }
  if (teks === "/antrian") {
    try {
      const j = await backend("GET", "/antrian");
      const daftar = j.antrian || [];
      await tele("sendMessage", {
        chat_id: chatId,
        text: daftar.length
          ? "Menunggu dijawab:\n" +
            daftar.map((r) => `• ${r.title} — ${r.date || "-"} (${r.segments} segmen)`).join("\n")
          : "Tidak ada rapat yang menunggu.",
      });
    } catch (e) {
      await tele("sendMessage", { chat_id: chatId, text: `Gagal menghubungi backend: ${e.message}` });
    }
    return;
  }
  if (teks === "/status") {
    const antri = fs.readdirSync(DIR_ANTRIAN).filter((n) => n.endsWith(".json")).length;
    await tele("sendMessage", {
      chat_id: chatId,
      text:
        `Backend: ${API_BASE}\n` +
        `Menunggu Claude: ${antri} tugas\n` +
        `Sudah ditawarkan: ${Object.keys(state.ditawarkan).length} rapat`,
    });
    return;
  }
}

/* ---------- putaran utama ---------- */

async function putaranUpdate() {
  for (;;) {
    try {
      const j = await tele("getUpdates", {
        offset: state.offset,
        timeout: 50,
        allowed_updates: ["message", "callback_query"],
      });
      for (const u of j.result || []) {
        state.offset = u.update_id + 1;
        tulisState(state);
        if (u.callback_query) await jawabTombol(u.callback_query);
        else if (u.message) await jawabPesan(u.message);
      }
    } catch (e) {
      console.warn("[SisKA] getUpdates:", e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function putaranBackend() {
  for (;;) {
    await cekAntrianBackend();
    await kirimKabarSelesai().catch((e) => console.warn("[SisKA] kabar:", e.message));
    await new Promise((r) => setTimeout(r, JEDA_CEK_MS));
  }
}

(async () => {
  const me = await tele("getMe", {});
  console.log(`[SisKA] tersambung sebagai @${me.result.username}`);
  console.log(`[SisKA] backend ${API_BASE}`);
  console.log(`[SisKA] chat berizin: ${CHAT_DIIZINKAN.join(", ")}`);
  console.log(`[SisKA] antrian: ${DIR_ANTRIAN}`);
  putaranUpdate();
  putaranBackend();
})().catch((e) => {
  console.error("[SisKA] gagal start:", e.message);
  process.exit(1);
});
