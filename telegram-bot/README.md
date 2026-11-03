# Bot Telegram SisKA — penawar notulen

Mengabari operator tiap ada rapat **Biasa** yang transkripnya selesai, lalu
menanyakan: notulennya disusun Claude, atau model lokal di server?

## Di mana botnya berjalan

Di **Server-GPP** (`192.168.63.41`), Windows Server 2016, sebagai tugas
terjadwal `SisKA-TelegramBot` dengan berkas di `C:\SisKA\telegram-bot`.
Hidup 24 jam, tidak bergantung pada PC siapa pun.

Mesin itu dipilih karena Telegram hanya lolos dari sebagian jaringan.
Diuji 3 November 2026:

| Dari | `api.telegram.org:443` | Backend `192.168.223.207` |
|---|---|---|
| VPS `192.168.223.207` | timeout | — |
| VPS `192.168.221.44` | timeout | — |
| **Server-GPP `192.168.63.41`** | **tersambung** | **200** |

Segmen `192.168.22x.x` memblokir Telegram, segmen `192.168.63.x` tidak. IP
tujuannya sama persis (`149.154.166.110`), jadi ini kebijakan jaringan per
segmen — bukan masalah DNS maupun IPv6.

Satu jebakan khas Server 2016: PowerShell/.NET di sana berjabat tangan dengan
TLS 1.0/1.1, yang ditolak Telegram, sehingga `Invoke-WebRequest` gagal dengan
"Could not create SSL/TLS secure channel". Itu **tidak** menyentuh bot ini —
Node membawa OpenSSL sendiri. Untuk menguji dari PowerShell, paksa dulu:

```powershell
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
```

## Alur

```
VPS: transkrip selesai (rapat BIASA)
        │
        │  LAN  GET /api/bot-telegram/antrian
        ▼
Server-GPP: bot SisKA ──► Telegram: judul + tanggal + ruang + tombol Ya/Tidak
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

### 2. Siapkan `.env`

```bash
cp telegram-bot/.env.example telegram-bot/.env
```

Isi `TELEGRAM_BOT_TOKEN`, `ALLOWED_CHAT_IDS`, dan `BOT_TELEGRAM_API_TOKEN`
(harus sama dengan yang di backend).

Cara tahu chat id Anda: kirim pesan apa pun ke bot, lalu buka
`https://api.telegram.org/bot<TOKEN>/getUpdates` dan lihat
`result[].message.chat.id`.

### 3. Pasang di Server-GPP

Masuk lewat RDP ke `192.168.63.41`, buka PowerShell **as Administrator**.

Pasang Node (v22 dipilih konservatif; rilis lebih baru menaikkan syarat versi
Windows, dan mesin ini Server 2016 build 14393):

```powershell
New-Item -ItemType Directory -Force C:\SisKA | Out-Null
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
$idx = (Invoke-WebRequest https://nodejs.org/dist/index.json -UseBasicParsing).Content | ConvertFrom-Json
$rel = $idx | Where-Object { $_.version -like 'v22.*' } | Select-Object -First 1
$msi = Join-Path $env:TEMP "node-$($rel.version)-x64.msi"
Invoke-WebRequest "https://nodejs.org/dist/$($rel.version)/node-$($rel.version)-x64.msi" -OutFile $msi -UseBasicParsing
Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait
```

Salin folder `telegram-bot` (termasuk `.env`) ke `C:\SisKA\`, lalu daftarkan
sebagai tugas terjadwal. Dibungkus `cmd.exe` supaya keluarannya tertulis ke
`bot.log`: proses milik SYSTEM tidak punya layar, jadi tanpa itu jejaknya
hilang saat bermasalah.

```powershell
$dir  = 'C:\SisKA\telegram-bot'
$node = "$env:ProgramFiles\nodejs\node.exe"
$arg  = '/c ""' + $node + '" index.js >> bot.log 2>&1"'
$aksi = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arg -WorkingDirectory $dir
$picu = New-ScheduledTaskTrigger -AtStartup
$akun = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$opsi = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'SisKA-TelegramBot' -Action $aksi -Trigger $picu -Principal $akun -Settings $opsi -Force
Start-ScheduledTask -TaskName 'SisKA-TelegramBot'
```

Periksa `Get-Content C:\SisKA\telegram-bot\bot.log -Tail 20`. Empat baris
pembuka harus muncul, diakhiri lokasi antrian.

`LastTaskResult` bernilai `267009` (`0x41301`) berarti **sedang berjalan** —
itu normal, bukan galat.

**Hanya satu bot boleh hidup per token.** Telegram melayani satu pembaca saja;
kalau bot lama di PC masih jalan, keduanya saling mencuri pesan dan tombolnya
jadi kadang menyahut kadang tidak.

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
