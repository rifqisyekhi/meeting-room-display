# Bot Telegram SisKA — penawar notulen

Mengabari operator tiap ada rapat **Biasa** yang transkripnya selesai, lalu
menanyakan: notulennya disusun Claude, atau model lokal di server?

## Kenapa botnya di PC, bukan di VPS

VPS tidak bisa menjangkau Telegram. Diuji 2 November 2026 dari `192.168.223.207`:

| Tujuan | Hasil |
|---|---|
| `google.com` | 200 dalam 0,14 s |
| `api.telegram.org` (IPv4 dipaksa) | timeout 20 s |
| `149.154.166.110:443` (hasil DNS-nya) | tidak tersambung |
| IPv6 keluar | mati, padahal DNS menjawab IPv6 lebih dulu |

PC operator bisa menjangkau Telegram **dan** backend lewat LAN, jadi botnya di
PC. Tidak ada setelan firewall yang perlu diubah.

## Alur

```
VPS: transkrip selesai (rapat BIASA)
        │
        │  LAN  GET /api/bot-telegram/antrian
        ▼
PC: bot SisKA ──────► Telegram: judul + tanggal + ruang + tombol Ya/Tidak
                                  (isi transkrip TIDAK ikut)
        ┌─────────────────────┴─────────────────────┐
     "Tidak"                                      "Ya"
        │                                           │
  POST .../lokal                        tulis antrian/<id>.json
        │                                           │
  gemma3 di VPS                     sesi Claude Code terjadwal:
                                      • ambil transkrip dari LAN
                                      • susun notulen
                                      • POST .../minutes
                                      • tulis antrian/selesai/<id>.json
                                                    │
                                    bot mengabarkan hasilnya ke Telegram
```

## Yang tidak keluar jaringan

Telegram hanya menerima judul rapat, tanggal, ruang, dan jumlah segmen.
Isi transkrip dan isi notulen tidak pernah dikirim ke server Telegram —
keduanya hanya lewat LAN.

Rapat juga tidak otomatis ikut. Kolom `classification` default-nya `RAHASIA`
(lihat `backend/src/db.js`), jadi rapat baru tertawar setelah admin menandainya
**Biasa** di Manajemen Rapat.

## Pasang

### 1. Token backend

Di `backend/.env` pada VPS, tambahkan token acak:

```bash
openssl rand -hex 32
```

```
BOT_TELEGRAM_API_TOKEN=<hasil perintah di atas>
```

Lalu `pm2 restart meeting-backend`. Tanpa variabel ini seluruh rute bot
menjawab 503 — ditutup, bukan terbuka.

### 2. Bot di PC

```bash
cp telegram-bot/.env.example telegram-bot/.env
```

Isi `TELEGRAM_BOT_TOKEN`, `ALLOWED_CHAT_IDS`, dan `BOT_TELEGRAM_API_TOKEN`
(harus sama dengan yang di backend).

Cara tahu chat id Anda: kirim pesan apa pun ke bot, lalu buka
`https://api.telegram.org/bot<TOKEN>/getUpdates` dan lihat
`result[].message.chat.id`.

### 3. Jalankan

```bash
node telegram-bot/index.js
```

Supaya hidup terus setelah PC menyala, pasang di pm2:

```bash
pm2 start telegram-bot/index.js --name siska-telegram && pm2 save
```

### 4. Penyusun notulen terjadwal

Buat tugas terjadwal Claude Code yang menjalankan isi
[`PROMPT-PENYUSUN.md`](PROMPT-PENYUSUN.md) tiap 10–15 menit. Itulah yang
mengerjakan jalur "Ya".

## Perintah di Telegram

| Perintah | Guna |
|---|---|
| `/start`, `/help` | keterangan singkat |
| `/antrian` | rapat yang masih menunggu dijawab |
| `/status` | kondisi bot dan jumlah tugas tertunda |

## Keamanan

- **`ALLOWED_CHAT_IDS` wajib.** Bot menolak start kalau kosong. Tanpa daftar
  izin, siapa pun yang menemukan `@siskarokeubot` bisa menyetujui notulen.
- **Token Telegram jangan dikirim lewat chat.** Kalau sudah pernah terkirim,
  cabut dan buat baru: `@BotFather` → `/revoke`.
- **`BOT_TELEGRAM_API_TOKEN` dibanding dengan waktu tetap** di
  `backend/src/routes/bot-telegram.routes.js`, jadi tidak bisa diterka
  byte demi byte dari selisih waktu jawaban.
- Rute bot hanya menerima rapat berklasifikasi `BIASA`; permintaan untuk rapat
  lain dijawab 403, termasuk permintaan transkrip.
