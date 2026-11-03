/* ===== TAWARAN NOTULEN LEWAT WHATSAPP =================================

   Tiap transkrip rapat BIASA selesai, operator dikabari di WhatsApp dan
   memilih: notulen disusun Claude, atau model lokal di server.

   Kenapa WhatsApp dan bukan Telegram: api.telegram.org tidak lolos dari
   segmen server. Diuji 2-3 Nov 2026 dari 192.168.223.207 DAN 192.168.221.44
   — keduanya timeout 20 s, sedangkan discord.com, slack.com, dan
   web.whatsapp.com menjawab 200. Jadi yang disasar kebijakan jaringan hanya
   Telegram. WhatsApp dipakai karena bot-siska yang sudah ada di 221.44
   terbukti bisa menjangkaunya.

   Pola balasannya mengikuti jalur persetujuan rapat yang sudah berjalan
   (lihat whatsapp.service.js): pesan memuat tag ID, operator QUOTE-REPLY
   pesan itu dengan "1" atau "2", lalu bot-siska meneruskan sender, message,
   dan quotedText ke webhook. Tag notulen sengaja "#NOT-" bukan "#MR-" supaya
   balasan notulen tidak tertukar dengan balasan persetujuan rapat.

   Yang keluar ke WhatsApp hanya judul, tanggal, ruang, dan jumlah segmen.
   Isi transkrip dan isi notulen tidak pernah dikirim.
*/

const fs = require("fs");
const path = require("path");

const dashboardService = require("./dashboard.service");
const notulen = require("./notulen.service");
const bot = require("./bot-telegram.service");

const DATA_DIR = path.join(__dirname, "../../data");
const BERKAS_TAWARAN = path.join(DATA_DIR, "notulen-tawaran.json");
const DIR_ANTRIAN = process.env.NOTULEN_ANTRIAN_DIR || path.join(DATA_DIR, "antrian-notulen");

const TAG = "#NOT-";

function galat(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/* ---------- nomor operator ---------- */

/* Sengaja variabel sendiri, bukan APPROVER_WHATSAPP_NUMBERS: yang memilih
   penyusun notulen itu operator/admin notulen, bukan atasan yang menyetujui
   permohonan ruang rapat. Dua peran berbeda, dua daftar nomor berbeda. */
function nomorOperator() {
  return String(process.env.NOTULEN_WHATSAPP_NUMBERS || "")
    .split(",")
    .map(normalisasiNomor)
    .filter(Boolean);
}

function normalisasiNomor(nomor) {
  const bersih = String(nomor || "").replace(/[^\d]/g, "");
  if (!bersih) return "";
  if (bersih.startsWith("0")) return `62${bersih.slice(1)}`;
  if (bersih.startsWith("62")) return bersih;
  if (bersih.startsWith("8")) return `62${bersih}`;
  return bersih;
}

/* ---------- penanda "sudah ditawarkan" ---------- */

/* Disimpan di berkas, bukan di memori, supaya restart backend tidak membuat
   operator dikirimi tawaran yang sama berulang kali. */
function bacaTawaran() {
  try {
    return JSON.parse(fs.readFileSync(BERKAS_TAWARAN, "utf8"));
  } catch {
    return {};
  }
}

function tulisTawaran(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BERKAS_TAWARAN, JSON.stringify(data, null, 2), "utf8");
}

/* ---------- kirim tawaran ---------- */

function teksTawaran(r) {
  const jam = r.start && r.end ? `${r.start} s.d ${r.end}` : r.start || "-";
  return `📝 *TRANSKRIP RAPAT SELESAI*
ID Notulen: ${TAG}${r.meetingId}

📌 *Rapat:* ${r.title || "Rapat"}
🏢 *Ruang:* ${r.room || "-"}
📅 *Tanggal:* ${r.date || "-"}
⏰ *Waktu:* ${jam} WIB
🎙 *Panjang transkrip:* ${r.segments} segmen
🔓 *Klasifikasi:* BIASA

--------------------------------------
*PILIHAN PENYUSUN NOTULEN:*
Silakan *QUOTE (Balas)* pesan ini:
👉 Ketik *1* untuk disusun *CLAUDE*
👉 Ketik *2* untuk disusun *MODEL LOKAL* (gemma3 di server)`;
}

async function kirimKeOperator(teks) {
  const sendUrl = process.env.BOT_SISKA_SEND_URL || "http://127.0.0.1:3000/send-message";
  const nomor = nomorOperator();
  if (!nomor.length) {
    throw galat("NOTULEN_WHATSAPP_NUMBERS belum diatur di backend/.env.", 503);
  }
  const hasil = [];
  for (const phone of nomor) {
    try {
      const r = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.BOT_SISKA_SEND_TOKEN
            ? { "x-webhook-token": process.env.BOT_SISKA_SEND_TOKEN }
            : {}),
        },
        body: JSON.stringify({ to: phone, phone, message: teks, text: teks }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) {
        const isi = await r.text().catch(() => "");
        console.warn(`[notulen-wa] gagal kirim ke ${phone}: HTTP ${r.status} ${isi.slice(0, 120)}`);
        hasil.push({ phone, success: false });
      } else {
        hasil.push({ phone, success: true });
      }
    } catch (err) {
      console.warn(`[notulen-wa] gagal menghubungi bot-siska di ${sendUrl}: ${err.message}`);
      hasil.push({ phone, success: false, error: err.message });
    }
  }
  return hasil;
}

async function tawarkan(r) {
  const hasil = await kirimKeOperator(teksTawaran(r));
  if (!hasil.some((h) => h.success)) return false;
  const tawaran = bacaTawaran();
  tawaran[r.meetingId] = { pada: new Date().toISOString(), judul: r.title };
  tulisTawaran(tawaran);
  console.log(`[notulen-wa] ditawarkan "${r.title}" (${r.meetingId})`);
  return true;
}

/* ---------- pemantau calon ---------- */

async function pantauSekali() {
  if (!nomorOperator().length) return; // belum dikonfigurasi, jangan ribut
  let calon;
  try {
    calon = await bot.daftarCalon(20);
  } catch (err) {
    if (err.statusCode !== 503) console.warn("[notulen-wa] gagal baca calon:", err.message);
    return;
  }
  const tawaran = bacaTawaran();
  for (const c of calon) {
    if (tawaran[c.meetingId]) continue;
    const meeting = await dashboardService.getMeetingById(c.meetingId).catch(() => null);
    if (!meeting) continue;
    await tawarkan({
      meetingId: c.meetingId,
      title: meeting.title || "Rapat",
      date: meeting.date || null,
      start: meeting.start || null,
      end: meeting.end || null,
      room: meeting.room || meeting.roomName || null,
      segments: c.segments,
    }).catch((e) => console.warn(`[notulen-wa] gagal menawarkan ${c.meetingId}:`, e.message));
  }
}

let timer = null;
function mulaiPemantau() {
  if (timer) return;
  const jeda = Math.max(Number(process.env.NOTULEN_WA_POLL_SECONDS) || 180, 30) * 1000;
  timer = setInterval(() => pantauSekali().catch(() => {}), jeda);
  if (timer.unref) timer.unref();
}

/* ---------- tangani balasan ---------- */

function ambilIdNotulen(teks) {
  const m = String(teks || "").match(/#?NOT-([a-zA-Z0-9_-]+)/i);
  return m ? m[1].trim() : null;
}

async function tanganiBalasan({ sender, message, text, quotedText, meetingId }) {
  const isi = String(message || text || "").trim();
  const pengirim = normalisasiNomor(sender);
  const nomor = nomorOperator();

  if (nomor.length && !nomor.includes(pengirim)) {
    console.warn(`[notulen-wa] balasan dari nomor tak terdaftar: ${pengirim}`);
    return {
      success: false,
      replyText:
        "⛔ Maaf, nomor Anda tidak terdaftar sebagai operator notulen Biro Keuangan dan BMN.",
    };
  }

  const id = meetingId || ambilIdNotulen(quotedText) || ambilIdNotulen(isi);
  if (!id) {
    return {
      success: false,
      replyText: `⚠️ ID notulen tidak ditemukan.\nPastikan Anda me-reply (quote) pesan yang berisi ${TAG}...`,
    };
  }

  const meeting = await dashboardService.getMeetingById(id).catch(() => null);
  if (!meeting) {
    return { success: false, replyText: `⚠️ Rapat dengan ID ${TAG}${id} tidak ditemukan.` };
  }

  const status = await notulen.statusRingan(meeting.id).catch(() => null);
  if (status && status.minutesMd) {
    return {
      success: false,
      replyText: `ℹ️ Notulen rapat "*${meeting.title}*" sudah ada. Periksa di Manajemen Rapat.`,
    };
  }

  const perintah = isi.toLowerCase();
  const pilihClaude = perintah === "1" || perintah.startsWith("1") || perintah.includes("claude");
  const pilihLokal =
    perintah === "2" || perintah.startsWith("2") || perintah.includes("lokal");

  if (!pilihClaude && !pilihLokal) {
    return {
      success: false,
      replyText: "⚠️ Balasan tidak dikenali.\nKetik *1* untuk Claude, atau *2* untuk model lokal.",
    };
  }

  if (pilihLokal) {
    const rooms = dashboardService.readStore().rooms || [];
    const ruangan = rooms.find((x) => x.name === (meeting.room || meeting.roomName)) || null;
    await notulen.buatUlangNotulen(meeting, ruangan, {}, "WhatsApp/lokal");
    return {
      success: true,
      action: "lokal",
      replyText: `🖥 Baik, notulen "*${meeting.title}*" sedang disusun model lokal di server. Hasilnya muncul di Manajemen Rapat.`,
    };
  }

  /* Pilihan Claude: tulis tugas ke antrian. Penyusunnya sesi Claude Code yang
     membaca antrian ini, bukan backend — supaya tidak ada kunci API cloud yang
     perlu disimpan di server. */
  fs.mkdirSync(DIR_ANTRIAN, { recursive: true });
  fs.writeFileSync(
    path.join(DIR_ANTRIAN, `${meeting.id}.json`),
    JSON.stringify(
      {
        meetingId: meeting.id,
        judul: meeting.title || "Rapat",
        dimintaOleh: pengirim,
        dimintaPada: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`[notulen-wa] masuk antrian Claude: ${meeting.id}`);
  return {
    success: true,
    action: "claude",
    replyText: `✅ Baik, notulen "*${meeting.title}*" masuk antrian Claude. Anda dikabari lagi kalau sudah jadi.`,
  };
}

/* Dipanggil setelah penyusun notulen selesai, supaya operator tahu. */
async function kabariSelesai(meetingId, { ok, judul, pesan } = {}) {
  const teks = ok
    ? `✅ *NOTULEN SIAP*\n\n📌 ${judul || meetingId}\n\n${pesan || "Sudah tersimpan. Silakan periksa di Manajemen Rapat."}`
    : `⚠️ *GAGAL MENYUSUN NOTULEN*\n\n📌 ${judul || meetingId}\n\n${pesan || "Silakan coba model lokal."}`;
  return kirimKeOperator(teks);
}

module.exports = {
  TAG,
  DIR_ANTRIAN,
  nomorOperator,
  normalisasiNomor,
  ambilIdNotulen,
  teksTawaran,
  tawarkan,
  pantauSekali,
  mulaiPemantau,
  tanganiBalasan,
  kabariSelesai,
};
