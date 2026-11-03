# Prompt penyusun notulen

Dipakai saat operator memilih "Claude" (balas **1** di WhatsApp, atau tombol
*Ya* di Telegram). Salin seluruh blok di bawah sebagai prompt.

Jalankan manual saat ada tawaran yang dijawab, atau jadikan tugas terjadwal
10–15 menit sekali.

## Di mana antriannya

Ada dua jalur, tergantung kanal yang dipakai:

| Kanal | Antrian | Cara membaca |
|---|---|---|
| **WhatsApp** (utama) | `backend/data/antrian-notulen/` di VPS `192.168.223.207` | SSH ke VPS |
| Telegram | `telegram-bot/antrian/` di PC operator | langsung dari disk |

Jalur WhatsApp yang utama, karena `api.telegram.org` tidak lolos dari segmen
server — diuji dari `192.168.223.207` dan `192.168.221.44`, keduanya timeout.

---

Kerjakan antrian notulen.

**Langkah:**

1. Baca berkas tugas di antrian (lihat tabel di atas untuk lokasinya). Tiap
   berkas `<meetingId>.json` berisi `meetingId`, `judul`, `dimintaOleh`,
   `dimintaPada`. Kalau antrian kosong, berhenti tanpa laporan apa pun.

2. Ambil `BOT_TELEGRAM_API_TOKEN` dari `backend/.env` di VPS.

3. Untuk setiap tugas, dengan `BASE = http://192.168.223.207` dan header
   `x-bot-token: <token>`:

   a. Keterangan rapat: `GET {BASE}/api/bot-telegram/meetings/{meetingId}`

   b. Transkrip: `GET {BASE}/api/bot-telegram/meetings/{meetingId}/transkrip`
      → `{ segments, speakers }`

   c. Susun notulen Markdown. **Ikuti `ai-service/app/prompts.py`** —
      `FINAL_FORMAT` untuk struktur, `SYSTEM` untuk aturan. Ringkasnya:

      - Bahasa Indonesia baku. Jangan bahasa Inggris.
      - Struktur persis: `## Ringkasan`, `## Pembahasan` (dengan `###` per
        topik), `## Keputusan`, `## Action Item` (tabel No/Tugas/PIC/Tenggat),
        `## Catatan dan Tindak Lanjut`.
      - **Jangan mengarang.** Hanya yang ada di transkrip.
      - PIC atau tenggat yang tidak disebut: tulis `-`.
      - Transkrip ini hasil Whisper `small` dan **sering salah dengar nama
        lembaga**. Yang sudah terbukti: "kemenangan" = Kemnaker, "SAKR" =
        Satker, "ESOLON" = Eselon, "Binalakotas" = Binalavotas, "Doarjo" =
        Sidoarjo, "Tukin May" = Tukin Mei. Betulkan yang jelas begitu, dan
        **sebutkan apa saja yang Anda betulkan** di `## Catatan dan Tindak
        Lanjut`. Jangan menebak nama orang atau angka.
      - Satu poin cukup muncul sekali. Jangan mengulang poin di beberapa `###`.
      - Jangan tulis judul, tanggal, tempat, atau peserta — backend yang
        menambahkannya.
      - Pakai nama dari `speakers` kalau ada; kalau tidak, biarkan `SPEAKER_1`.

   d. Simpan: `POST {BASE}/api/bot-telegram/meetings/{meetingId}/minutes`
      body `{ "markdown": "<hasil>", "model": "claude-opus-5" }`

   e. Kabari operator. Jalur WhatsApp, dari dalam VPS:
      `node -e 'require("./src/services/notulen-wa.service").kabariSelesai("<meetingId>", {ok:true, judul:"<judul>"})'`
      dijalankan dari `~/apps/meeting-room-display/backend`.
      Jalur Telegram: tulis `telegram-bot/antrian/selesai/<meetingId>.json`
      berisi `{ meetingId, judul, chatId, ok, pesan }` — botnya yang mengirim.

   f. Hapus berkas tugasnya.

4. Kalau satu tugas gagal, jangan batalkan yang lain. Kabari operator dengan
   `ok:false` dan sebabnya singkat, lalu hapus berkas tugasnya supaya tidak
   dicoba terus-menerus.

**Batas yang tidak boleh dilanggar:**

- Hanya rapat yang ada berkas tugasnya. Rute transkrip menolak rapat
  non-`BIASA` dengan 403 — kalau itu terjadi, catat sebagai gagal, jangan
  diakali.
- Jangan kirim isi transkrip atau isi notulen ke WhatsApp/Telegram. Yang boleh
  keluar hanya judul dan pesan singkat.
- Jangan `git pull`, `fetch`, atau `checkout` apa pun di `192.168.221.44`.
  Itu mesin produksi yang dipakai sehari-hari.
