const dashboardService = require("./dashboard.service");

/**
 * Normalisasi nomor telepon ke format 628xxxxxxxx (hanya angka)
 */
function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).split("@")[0].replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Ambil daftar nomor WhatsApp atasan dari environment variable
 */
function getApproverPhones() {
  const envVal = process.env.APPROVER_WHATSAPP_NUMBERS || "";
  return envVal
    .split(/[,;]/)
    .map((p) => normalizePhone(p.trim()))
    .filter(Boolean);
}

/**
 * Ekstrak ID booking dari teks pesan (mendukung #MR-xxx, MR-xxx, ID: xxx)
 */
function extractMeetingId(text) {
  if (!text) return null;
  const match =
    text.match(/#?MR-([a-zA-Z0-9_-]+)/i) ||
    text.match(/ID\s*Booking\s*:\s*#?MR-?([a-zA-Z0-9_-]+)/i) ||
    text.match(/ID\s*Booking\s*:\s*#?([a-zA-Z0-9_-]+)/i) ||
    text.match(/ID\s*:\s*#?([a-zA-Z0-9_-]+)/i);

  return match ? match[1].trim() : null;
}

/**
 * Susun format pesan notifikasi permohonan ruang rapat untuk atasan
 */
function formatNotificationMessage(meeting) {
  const idStr = meeting.id ? String(meeting.id) : Date.now().toString();
  return (
`🔔 *PERMOHONAN PINJAM RUANG RAPAT*
ID Booking: #MR-${idStr}

📌 *Agenda:* ${meeting.title || meeting.agenda || "Rapat Koordinasi"}
🏢 *Ruang:* ${meeting.room || "Ruang Rapat"}
👤 *Pemesan / Bagian:* ${meeting.requester || meeting.bagian || "-"}
📅 *Tanggal:* ${meeting.date || "-"}
⏰ *Waktu:* ${meeting.start || "-"} s.d ${meeting.end || "-"} WIB
👥 *Jumlah Peserta:* ${meeting.participants || "-"} Orang
📝 *Keterangan:* ${meeting.desc || "-"}

--------------------------------------
*PILIHAN PERSETUJUAN:*
Silakan *QUOTE (Balas)* pesan ini:
👉 Ketik *1* untuk *MENYETUJUI (Approve)*
👉 Ketik *2* untuk *MENOLAK*`
  );
}

/**
 * Kirim notifikasi permohonan rapat baru ke semua nomor WhatsApp atasan via Bot SisKA
 */
async function sendNotificationToApprovers(meeting) {
  const approverPhones = getApproverPhones();
  const sendUrl = process.env.BOT_SISKA_SEND_URL || "http://127.0.0.1:3000/send-message";

  if (approverPhones.length === 0) {
    console.log("ℹ️ [WhatsApp Service] Belum ada APPROVER_WHATSAPP_NUMBERS yang diatur di .env backend.");
    return { success: false, error: "APPROVER_WHATSAPP_NUMBERS is not configured" };
  }

  const messageText = formatNotificationMessage(meeting);
  const results = [];

  for (const phone of approverPhones) {
    try {
      console.log(`📤 [WhatsApp Service] Mengirim notifikasi rapat #${meeting.id} ke WhatsApp ${phone}...`);
      const response = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          phone: phone,
          message: messageText,
          text: messageText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ [WhatsApp Service] Gagal kirim ke ${phone}: HTTP ${response.status} - ${errorText}`);
        results.push({ phone, success: false, error: errorText });
      } else {
        console.log(`✅ [WhatsApp Service] Notifikasi berhasil dikirim ke ${phone}`);
        results.push({ phone, success: true });
      }
    } catch (err) {
      console.error(`❌ [WhatsApp Service] Gagal menghubungi bot-siska di ${sendUrl}:`, err.message);
      results.push({ phone, success: false, error: err.message });
    }
  }

  return { success: true, results };
}

/**
 * Tangani pesan balasan (quote reply 1 / 2) dari WhatsApp atasan
 */
async function handleApproverReply({ sender, message, text, quotedText, meetingId }) {
  const replyContent = String(message || text || "").trim();
  const senderPhone = normalizePhone(sender);
  const approverPhones = getApproverPhones();

  // Validasi nomor pengirim jika nomor atasan dikonfigurasi di .env
  if (approverPhones.length > 0 && !approverPhones.includes(senderPhone)) {
    console.warn(`⛔ [WhatsApp Service] Nomor pengirim ${senderPhone} tidak ada dalam daftar APPROVER_WHATSAPP_NUMBERS.`);
    return {
      success: false,
      replyText: "⛔ Maaf, nomor WhatsApp Anda tidak terdaftar sebagai Atasan / Pimpinan yang berwenang menyetujui permohonan ruang rapat.",
    };
  }

  // Cari ID Rapat target
  let targetId = meetingId;
  if (!targetId) {
    targetId = extractMeetingId(quotedText) || extractMeetingId(replyContent);
  }

  if (!targetId) {
    return {
      success: false,
      replyText:
        "⚠️ ID Permohonan rapat tidak ditemukan.\nPastikan Anda me-reply (quote) pesan permohonan yang berisi #MR-...",
    };
  }

  // Cari meeting di store
  const store = dashboardService.readStore();
  const meetings = store.meetings || [];
  const meeting = meetings.find(
    (m) =>
      String(m.id) === String(targetId) ||
      (m.googleId && String(m.googleId) === String(targetId)) ||
      String(m.id).endsWith(String(targetId))
  );

  if (!meeting) {
    return {
      success: false,
      replyText: `⚠️ Permohonan rapat dengan ID #${targetId} tidak ditemukan di sistem.`,
    };
  }

  // Cek apakah status masih "Menunggu Approval"
  if (meeting.status !== "Menunggu Approval") {
    const infoBy = meeting.approvedBy ? ` oleh ${meeting.approvedBy}` : "";
    return {
      success: false,
      replyText: `ℹ️ Permohonan rapat "*${meeting.title}*" sudah diproses sebelumnya dengan status: *${meeting.status}*${infoBy}.`,
    };
  }

  // Parse instruksi balas 1 (Setujui) atau 2 (Tolak)
  const cleanCmd = replyContent.toLowerCase();
  const isApprove =
    cleanCmd === "1" ||
    cleanCmd.startsWith("1") ||
    cleanCmd.includes("setuju") ||
    cleanCmd.includes("approve") ||
    cleanCmd.includes("acc");

  const isReject =
    cleanCmd === "2" ||
    cleanCmd.startsWith("2") ||
    cleanCmd.includes("tolak") ||
    cleanCmd.includes("reject") ||
    cleanCmd.includes("batal");

  if (isApprove) {
    meeting.status = "Akan Datang";
    meeting.approvedBy = `Atasan (WA: ${senderPhone || "WhatsApp"})`;
    meeting.approvedAt = new Date().toISOString();

    // Simpan & otomatis sync ke Google Calendar
    await dashboardService.saveMeeting(meeting);
    console.log(`✅ [WhatsApp Service] Rapat #${meeting.id} ("${meeting.title}") BERHASIL DISETUJUI via WhatsApp oleh ${meeting.approvedBy}`);

    return {
      success: true,
      action: "APPROVED",
      meeting,
      replyText:
`✅ *Permohonan Rapat Berhasil Disetujui!*

📌 *Agenda:* ${meeting.title}
🏢 *Ruangan:* ${meeting.room}
📅 *Waktu:* ${meeting.date} (${meeting.start} - ${meeting.end} WIB)
👤 *Disetujui oleh:* ${meeting.approvedBy}

Jadwal resmi telah dikonfirmasi dan disinkronkan ke Google Calendar serta layar Display TV.`,
    };
  } else if (isReject) {
    meeting.status = "Dibatalkan";
    meeting.approvedBy = `Ditolak Atasan (WA: ${senderPhone || "WhatsApp"})`;
    meeting.approvedAt = new Date().toISOString();

    // Simpan & hapus dari Google Calendar jika ada
    await dashboardService.saveMeeting(meeting);
    console.log(`❌ [WhatsApp Service] Rapat #${meeting.id} ("${meeting.title}") DITOLAK via WhatsApp oleh ${meeting.approvedBy}`);

    return {
      success: true,
      action: "REJECTED",
      meeting,
      replyText:
`❌ *Permohonan Rapat Ditolak.*

📌 *Agenda:* ${meeting.title}
🏢 *Ruangan:* ${meeting.room}
📅 *Waktu:* ${meeting.date} (${meeting.start} - ${meeting.end} WIB)

Status permohonan telah diubah menjadi Dibatalkan.`,
    };
  } else {
    return {
      success: false,
      replyText:
`⚠️ Perintah tidak dikenali.

Silakan QUOTE (Balas) pesan notifikasi dengan:
👉 Ketik *1* untuk *MENYETUJUI*
👉 Ketik *2* untuk *MENOLAK*`,
    };
  }
}

module.exports = {
  normalizePhone,
  getApproverPhones,
  formatNotificationMessage,
  sendNotificationToApprovers,
  handleApproverReply,
};
