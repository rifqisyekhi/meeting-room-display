/* Pemeriksaan konfigurasi saat backend menyala.

   Semua akun master punya password cadangan yang tertulis di dalam kode
   (admin123 dan seterusnya). Itu memudahkan saat pengembangan, tapi di
   server yang bisa dijangkau satu kantor, password yang nilainya ada di
   dalam repo sama saja dengan tanpa password.

   Kode sengaja TIDAK menolak menyala — papan TV dan halaman QR tidak boleh
   ikut mati gara-gara konfigurasi yang belum lengkap. Yang dilakukan hanya
   membuat kelalaiannya mustahil dilewatkan oleh siapa pun yang membaca log. */

const DEFAULT_BAWAAN = {
  ADMIN_PASSWORD: "admin123",
  APPROVAL_PASSWORD: "approval123",
  APPROVAL1_PASSWORD: "approval123",
  USER_PASSWORD: "user123",
  USER_ANDI_PASSWORD: "user123",
};

function auditKonfigurasi() {
  const masalah = [];

  const pakaiDefault = Object.keys(DEFAULT_BAWAAN).filter((kunci) => {
    const nilai = process.env[kunci];
    return !nilai || nilai === DEFAULT_BAWAAN[kunci];
  });

  if (pakaiDefault.length) {
    masalah.push(
      `Password akun berikut masih memakai nilai bawaan yang tertulis di kode: ${pakaiDefault.join(", ")}`
    );
  }

  if (!process.env.SESSION_SECRET) {
    masalah.push(
      "SESSION_SECRET belum diisi — sesi login gugur setiap backend di-restart."
    );
  }

  if (!process.env.BOT_SISKA_WEBHOOK_TOKEN) {
    masalah.push(
      "BOT_SISKA_WEBHOOK_TOKEN belum diisi — jalur persetujuan WhatsApp terbuka untuk siapa saja."
    );
  }

  if (!process.env.DATABASE_URL) {
    masalah.push(
      "DATABASE_URL belum diisi — data hanya disimpan di dashboard-store.json dan akan hilang bila berkas itu terhapus."
    );
  }

  if (!process.env.AI_SERVICE_TOKEN) {
    masalah.push(
      "AI_SERVICE_TOKEN belum diisi — service AI notulen (127.0.0.1:8000) bisa dipanggil proses lain di server tanpa token."
    );
  }

  if (!masalah.length) {
    console.log("[konfigurasi] Semua pemeriksaan keamanan dasar terpenuhi.");
    return;
  }

  console.warn("\n" + "=".repeat(68));
  console.warn("  PERINGATAN KONFIGURASI — belum aman untuk dipakai banyak orang");
  console.warn("=".repeat(68));
  masalah.forEach((m, i) => console.warn(`  ${i + 1}. ${m}`));
  /* Nama proses pm2 berbeda antar server (meeting-backend, 
     meeting-room-display-api, ...), jadi jangan dipatok di kode — pesan
     yang menyebut nama yang salah justru menyesatkan saat deploy. */
  const namaProses = process.env.name || process.env.PM2_PROCESS_NAME || "<nama-proses-pm2>";
  console.warn(`  Perbaiki di backend/.env lalu jalankan: pm2 restart ${namaProses}`);
  console.warn("=".repeat(68) + "\n");
}

module.exports = { auditKonfigurasi };
