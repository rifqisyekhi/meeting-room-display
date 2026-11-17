# Prompt penyusun notulen

Berkas ini **dibaca sendiri oleh Claude Code** dari folder kerjanya, tiap 15
menit, dipicu `C:\SisKA\jalankan-penyusun.ps1` di server 2. Pembungkus itu
hanya memberi satu kalimat pendek: "baca berkas ini lalu kerjakan isinya".

Isinya sengaja tidak lagi dikirim lewat argumen baris perintah. Dulu begitu,
dan rusak dua kali: backtick di sini dimakan escaping PowerShell, dan prompt
5 KB terpotong di ujungnya — justru bagian yang memuat token.

Jadi tulis berkas ini sebagai perintah untuk dikerjakan, bukan sebagai
dokumentasi untuk dibaca manusia.

---

Kerjakan antrian notulen.

Anda berjalan **tanpa pengawasan** di server 2 (`192.168.63.26`, Windows).
Tidak ada yang bisa menjawab pertanyaan, jadi jangan bertanya — kalau sesuatu
tidak jelas, catat sebagai gagal dan lanjutkan ke tugas berikutnya.

**Langkah:**

0. Ambil tiga nilai dari **environment variable**, bukan dari berkas mana pun:

   - `SISKA_ANTRIAN` — folder antrean tugas
   - `SISKA_BASE` — alamat backend, dipakai sebagai `BASE` di bawah
   - `SISKA_TOKEN` — isi header `x-bot-token`

   Jangan memakai alamat atau token dari ingatan, dari berkas lain, atau dari
   contoh di dokumen ini. Backend bisa berpindah, dan environment selalu berisi
   yang sedang dipakai bot. Kalau salah satunya kosong, hentikan seluruh tugas
   dan laporkan gagal — jangan menebak.

1. Baca berkas tugas di `SISKA_ANTRIAN`. Tiap berkas `<meetingId>.json` berisi
   `meetingId`, `judul`, `dimintaOleh`, `messageId`, `dimintaPada`. Kalau
   antrean kosong, berhenti tanpa laporan apa pun.

2. Untuk setiap tugas, dengan `BASE` dan `x-bot-token` dari langkah 0:

   Backend diakses lewat HTTP biasa di jaringan internal, bukan HTTPS. Di
   Windows, `Invoke-RestMethod` paling mudah dipakai.

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
      - Transkrip ini hasil Whisper — `small` atau `turbo`, lihat kolom
        `whisper_model` — dan **sering salah dengar nama lembaga**. Keduanya
        salah dengar, tapi tidak pada kata yang sama.

        Terbukti pada `small`: "kemenangan" = Kemnaker, "SAKR" = Satker,
        "ESOLON" = Eselon, "Binalakotas" = Binalavotas, "Doarjo" = Sidoarjo,
        "Tukin May" = Tukin Mei.

        Terbukti pada `turbo` (rapat 2 Nov 2026): "manajemen di Atlanta" =
        manajemen talenta, "Pendinaan Penyelenggaran" = Pembinaan
        Penyelenggaraan, "Badan Penggawain Negara" = Badan Kepegawaian Negara,
        "BKS" = BKN, "asesmen senter" = assessment center.

        Betulkan yang jelas begitu, dan **sebutkan apa saja yang Anda
        betulkan** di `## Catatan dan Tindak Lanjut`. Jangan menebak nama
        orang atau angka.
      - Satu poin cukup muncul sekali. Jangan mengulang poin di beberapa `###`.
      - Jangan tulis judul, tanggal, tempat, atau peserta — backend yang
        menambahkannya.
      - Pakai nama dari `speakers` kalau ada; kalau tidak, biarkan `SPEAKER_1`.

   d. Simpan: `POST {BASE}/api/bot-telegram/meetings/{meetingId}/minutes`
      body `{ "markdown": "<hasil>", "model": "claude-opus-5" }`

   e. Kabari operator: tulis berkas `<SISKA_ANTRIAN>\selesai\<meetingId>.json`,
      berisi `{ meetingId, judul, chatId, ok, pesan }`.
      `chatId` diambil dari `dimintaOleh` pada berkas tugas. Botnya yang
      mengirim ke Telegram — Anda cukup menulis berkasnya.

   f. Hapus berkas tugasnya.

3. Kalau satu tugas gagal, jangan batalkan yang lain. Tulis berkas selesai
   dengan `ok: false` dan sebabnya singkat, lalu hapus berkas tugasnya supaya
   tidak dicoba terus-menerus tiap 15 menit.

**Batas yang tidak boleh dilanggar:**

- Hanya rapat yang ada berkas tugasnya. Rute transkrip menolak rapat
  non-`BIASA` dengan 403 — kalau itu terjadi, catat sebagai gagal, jangan
  diakali.
- **Jangan kirim isi transkrip atau isi notulen ke Telegram.** Yang boleh
  masuk ke `pesan` hanya judul dan keterangan singkat. Isi rapat tidak boleh
  keluar dari jaringan internal.
- Jangan menyentuh apa pun di luar folder kerja dan `SISKA_ANTRIAN`, selain
  memanggil `SISKA_BASE`. Khususnya `C:\SisKA\telegram-bot\` — itu milik bot,
  dan `.env`-nya berisi token Telegram yang tidak ada urusannya dengan tugas
  ini.

---

## Catatan untuk manusia, bukan bagian perintah

Jalur WhatsApp (`notulen-wa.service`) punya antreannya sendiri di
`backend/data/antrian-notulen/` pada VPS `192.168.223.207`, dan **tidak**
dikerjakan tugas terjadwal ini. Jalur itu dijalankan manual dari sesi Claude
Code yang punya akses SSH ke VPS, dengan memanggil
`kabariSelesai()` untuk memberi kabar balik.
