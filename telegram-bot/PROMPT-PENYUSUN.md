# Prompt penyusun notulen (untuk tugas terjadwal Claude Code)

Jalankan ini tiap 10–15 menit. Isinya sengaja ditulis sebagai perintah siap
tempel, bukan penjelasan — salin seluruh blok di bawah sebagai prompt tugas.

---

Kerjakan antrian notulen Telegram di proyek ini.

**Langkah:**

1. Baca semua berkas `*.json` di `telegram-bot/antrian/` (bukan di
   subfolder `selesai/`). Kalau kosong, berhenti dan jangan laporkan apa pun.

2. Baca `telegram-bot/.env` untuk `BACKEND_URL` dan `BOT_TELEGRAM_API_TOKEN`.

3. Untuk setiap tugas, dengan `meetingId` dari berkas itu:

   a. Ambil keterangan rapat:
      `GET {BACKEND_URL}/api/bot-telegram/meetings/{meetingId}`
      dengan header `x-bot-token: {BOT_TELEGRAM_API_TOKEN}`

   b. Ambil transkripnya:
      `GET {BACKEND_URL}/api/bot-telegram/meetings/{meetingId}/transkrip`
      dengan header yang sama. Balasannya `{ segments, speakers }`.

   c. Susun notulen Markdown dari transkrip itu. **Ikuti format dan aturan
      di `ai-service/app/prompts.py`** — `FINAL_FORMAT` untuk strukturnya dan
      `SYSTEM` untuk aturannya. Ringkasnya:

      - Bahasa Indonesia baku. Jangan pakai bahasa Inggris.
      - Struktur persis: `## Ringkasan`, `## Pembahasan` (dengan `###` per
        topik), `## Keputusan`, `## Action Item` (tabel No/Tugas/PIC/Tenggat),
        `## Catatan dan Tindak Lanjut`.
      - **Jangan mengarang.** Hanya yang ada di transkrip.
      - PIC atau tenggat yang tidak disebut: tulis `-`.
      - Transkrip ini hasil mesin dan bisa salah dengar. Perbaiki hanya kalau
        maksudnya jelas dari konteks; **jangan menebak nama orang atau angka.**
        Nama lembaga yang kacau (mis. "kemenangan" untuk Kemnaker, "SAKR"
        untuk Satker) boleh dibetulkan bila jelas, dan sebutkan yang Anda
        betulkan di `## Catatan dan Tindak Lanjut`.
      - Satu poin cukup muncul sekali. Jangan mengulang poin yang sama di
        beberapa `###`.
      - Jangan tulis judul, tanggal, tempat, atau daftar peserta — backend
        yang menambahkannya.
      - Pakai nama pembicara dari `speakers` kalau ada; kalau tidak, biarkan
        `SPEAKER_1` dan seterusnya.

   d. Simpan:
      `POST {BACKEND_URL}/api/bot-telegram/meetings/{meetingId}/minutes`
      body `{ "markdown": "<hasil>", "model": "claude-opus-5" }`

   e. Tulis `telegram-bot/antrian/selesai/{meetingId}.json`:
      ```json
      {
        "meetingId": "...",
        "judul": "<judul rapat>",
        "chatId": "<dimintaOleh dari berkas tugas>",
        "ok": true,
        "pesan": "Notulen sudah tersimpan. Silakan periksa di Manajemen Rapat."
      }
      ```

   f. Hapus berkas tugas di `telegram-bot/antrian/{meetingId}.json`.

4. Kalau satu tugas gagal, jangan batalkan yang lain. Tulis berkas `selesai/`
   dengan `"ok": false` dan `"pesan"` berisi sebabnya secara singkat, lalu
   hapus berkas tugasnya supaya tidak dicoba terus-menerus.

**Batas yang tidak boleh dilanggar:**

- Hanya rapat yang dikirim backend. Rute transkrip menolak rapat non-`BIASA`
  dengan 403 — kalau itu terjadi, catat sebagai gagal, jangan diakali.
- Jangan kirim isi transkrip atau isi notulen ke Telegram. Bot yang mengabari
  operator, dan ia hanya memakai `judul` serta `pesan` singkat.
- Jangan menyentuh rapat yang tidak ada berkas tugasnya.
