# Notulen Otomatis (Manajemen Rapat → Admin)

Admin dapat merekam rapat langsung di browser atau mengunggah file audio. Sistem lalu membuat
**transkrip** (dengan label pembicara bila diaktifkan) dan **draf notulen** (ringkasan, pembahasan,
keputusan, action item). Semua pemrosesan berjalan **lokal di server**: tidak ada audio atau teks rapat
yang dikirim ke layanan cloud.

```
Browser (dashboard Admin)
   │  rekam / unggah / proses / sunting          cookie sesi mrd_session, peran Admin
   ▼
Backend Express  /api/notulen/*  ── PostgreSQL: meeting_audio_files, meeting_minutes
   │  path file audio + metadata rapat            pemantau job tiap 3 detik
   ▼
ai-service (FastAPI, 127.0.0.1:8000) ── Whisper (transkripsi) → sherpa-onnx (pembicara) → Ollama (notulen)
   ▲
   └── membaca audio dari folder yang sama: NOTULEN_STORAGE_DIR = STORAGE_DIR (default backend/data/notulen)
```

## Menjalankan di pengembangan (Windows, laptop baru)

Kebutuhan: Git, Node 20+, PostgreSQL, Python (versi apa pun, hanya untuk memasang `uv`), dan
[Ollama for Windows](https://ollama.com/download). Disarankan RAM ≥ 16 GB dengan ≥ 6 GB bebas.

```powershell
git clone <url-repo> meeting-room-display
cd meeting-room-display
git switch notulen-sakeh

# 1. Service AI (Python 3.11 lewat uv; terminal 1)
python -m pip install --user uv
cd ai-service
python -m uv venv --python 3.11 .venv
python -m uv pip install --python .venv\Scripts\python.exe -r requirements.txt
copy .env.example .env
#    di .env: ENABLE_DIARIZATION=true bila ingin uji pemisahan pembicara (STORAGE_DIR default sudah benar)
.venv\Scripts\python.exe scripts\download_models.py --diarization
.venv\Scripts\python.exe -m app                     # http://127.0.0.1:8000/docs

# 2. Ollama (sekali saja)
ollama pull qwen3:4b

# 3. Backend (terminal 2): .env seperti biasa; variabel notulen opsional di dev (lihat tabel di bawah)
cd backend && npm install && npm run dev

# 4. Frontend (terminal 3)
cd frontend && npm install && npm run dev            # http://localhost:5173 → login admin → Manajemen Rapat → 🎙 Notulen
```

- `localhost` dianggap aman oleh browser, jadi fitur **rekam** bisa diuji di dev tanpa HTTPS.
- Tabel `meeting_audio_files` dan `meeting_minutes` dibuat otomatis saat backend menyala.
- Fitur ini **butuh PostgreSQL**. Di mode fallback file JSON, semua rute notulen menjawab 503.
- Deploy ke server: [DEPLOY_NOTULEN.md](DEPLOY_NOTULEN.md).

## Perekam otomatis ruang rapat (opsi A)

Setiap rapat yang sudah disetujui di ruangan yang punya perekam aktif **direkam otomatis**, lalu
**diproses otomatis** setelah rapat selesai. Jika ada beberapa rapat, notulennya dibuat bergantian
sesuai antrean service AI. Jika tidak ada rekaman otomatis (perangkat mati atau mic bermasalah),
admin tetap bisa merekam atau **mengunggah file** secara manual (opsi B).

```
Mic Logitech ──USB──▶ PC / mini PC ruang rapat ── Chrome: https://<server>/perekam ──▶ backend ──▶ ai-service
                                                   (token perangkat, tanpa login)
Smart TV ── https://<server>/display  →  menampilkan "● SEDANG DIREKAM" selama perekaman
```

**Memasang perangkat**

1. Admin: Manajemen Rapat → 🎙 Notulen (rapat mana saja) → **📡 Perekam ruangan** → pilih ruangan →
   **Buat kode pemasangan**. Kodenya berisi 8 karakter, berlaku 30 menit, dan hanya bisa dipakai sekali.
2. Di PC ruang rapat yang tersambung mic: buka `https://<server>/perekam` di Chrome/Edge, lalu
   ketik kodenya.
3. Izinkan mikrofon dan pilih mic Logitech. Biarkan halaman tetap terbuka; agar menyala sendiri,
   lihat bagian *Mode kiosk* di [DEPLOY_NOTULEN.md](DEPLOY_NOTULEN.md).

**Aturan rekam**

- Hanya rapat yang **disetujui**. Rapat yang menunggu persetujuan, ditolak, dibatalkan, atau sudah
  check-out tidak direkam.
- Perekaman berjalan dari jam mulai sampai `NOTULEN_REKAM_LEBIH_MENIT` (default 15) menit setelah jam
  selesai, untuk rapat yang molor. Rekaman berhenti lebih awal bila sudah check-out atau rapat
  berikutnya di ruangan yang sama dimulai.
- Setiap rapat menjadi satu file rekaman (file baru bila halaman perekam sempat dimuat ulang).
- Rapat diproses otomatis ±1–3 menit setelah rekamannya selesai terkirim. Jika service AI sedang
  mati atau RAM kurang, pemrosesan dicoba lagi tiap menit.
- Admin memantau perangkat di halaman **📡 Perekam ruangan**: Siap / ● Merekam / Mengirim /
  Mic bermasalah / Offline, nama mic, dan peringatan "tidak ada suara terdeteksi" bila 2 menit
  merekam tanpa suara.

**Keamanan:** halaman `/perekam` tidak memakai login. Perangkat memegang token acak (yang disimpan
di database hanya hash-nya) dan hanya bisa merekam rapat yang **sedang berjalan di ruangannya
sendiri**. Admin bisa mencabutnya kapan saja. Papan TV hanya menerima informasi ya/tidak per ruangan.

## Memilih model

Di layar Notulen (kartu "3. Proses") admin memilih **model transkripsi** (Whisper) dan **model
notulen** (Ollama) per rapat. Daftar pilihannya diatur di `ai-service/.env`:

```ini
WHISPER_MODEL=small                         # default
WHISPER_ALLOWED_MODELS=small,medium,turbo   # yang boleh dipilih
OLLAMA_MODEL=qwen3:4b                       # default
OLLAMA_ALLOWED_MODELS=                      # kosong = semua yang sudah di-"ollama pull"
```

Model Whisper yang belum diunduh ditandai "belum diunduh" dan diunduh otomatis saat pertama dipakai
(butuh internet). Model Ollama harus di-`ollama pull` dulu. Ambang RAM dihitung sesuai model yang dipilih.

## Variabel `backend/.env`

| Variabel | Default | Keterangan |
|---|---|---|
| `AI_SERVICE_URL` | `http://127.0.0.1:8000` | Service AI lokal. Jangan arahkan ke layanan cloud. |
| `AI_SERVICE_TOKEN` | kosong | Sama dengan `API_TOKEN` di `ai-service/.env`. Wajib diisi di server. |
| `NOTULEN_STORAGE_DIR` | `backend/data/notulen` | Folder audio rapat (masuk `.gitignore`). |
| `NOTULEN_MAX_UPLOAD_MB` | `2048` | Batas ukuran unggahan file audio. |
| `NOTULEN_REKAM_LEBIH_MENIT` | `15` | Perekam otomatis tetap merekam sekian menit setelah jam selesai (rapat molor). |

## API backend (`/api/notulen`, semua khusus peran Admin)

`:id` = ID rapat (boleh ID Google Calendar). Respons berformat `{ success, ... }` atau
`{ success: false, error }` dengan pesan berbahasa Indonesia.

| Method | Path | Fungsi |
|---|---|---|
| GET | `/status-ai` | Status service AI (RAM, model, antrean, Ollama) |
| GET | `/models` | Pilihan model Whisper & Ollama (+ RAM, status unduh) |
| GET | `/meetings/:id` | Data rapat + daftar file audio + transkrip + notulen |
| GET | `/meetings/:id/status` | Status ringan untuk polling progress |
| POST | `/meetings/:id/recordings` | Mulai sesi rekam baru → `{ file.id }`. Body: `{ mimeType }` |
| PUT | `/meetings/:id/recordings/:fileId/chunks/:seq` | Kirim potongan ke-`seq` (body biner). Idempoten: seq lama diabaikan, seq meloncat → 409 + `expectedSeq` |
| POST | `/meetings/:id/recordings/:fileId/finish` | Tandai rekaman selesai |
| POST | `/meetings/:id/audio` | Unggah file (body biner, dialirkan ke disk). Header `X-File-Name` (URL-encoded), `X-File-Type` |
| GET | `/meetings/:id/audio/:fileId` | Putar/unduh file audio (mendukung Range) |
| DELETE | `/meetings/:id/audio/:fileId` | Hapus file audio (ditolak saat sedang diproses) |
| POST | `/meetings/:id/process` | Proses semua file berurutan. Body: `{ numSpeakers?, diarization?, summarize?, whisperModel?, llmModel? }` |
| POST | `/meetings/:id/regenerate` | Buat ulang notulen dari transkrip + nama pembicara. Body: `{ llmModel? }` |
| POST | `/meetings/:id/cancel` | Batalkan proses yang berjalan |
| PUT | `/meetings/:id/speakers` | `{ speakers: { "SPEAKER_1": "Pak Budi" } }` |
| PUT | `/meetings/:id/minutes` | `{ markdown, reviewed }`: simpan hasil sunting notulis |
| DELETE | `/meetings/:id/minutes` | Hapus transkrip & notulen (audio tetap) |
| GET | `/meetings/:id/minutes.md` | Unduh notulen `.md` |
| GET | `/perekam` | Daftar perangkat perekam + status + daftar ruangan |
| POST | `/perekam` | Buat perangkat & kode pemasangan. Body: `{ roomName, label? }` |
| POST | `/perekam/:id/kode` | Kode pemasangan baru (token lama gugur) |
| DELETE | `/perekam/:id` | Cabut perangkat |

API perangkat (`/api/perekam`, header `X-Perangkat-Token`, tanpa login): `POST /pasang {kode}`,
`POST /detak` (lapor status; jawabannya: rekam atau tidak + rapat aktif), `POST /rekaman {meetingId}`,
`PUT /rekaman/:fileId/potongan/:seq`, `POST /rekaman/:fileId/selesai`. Publik untuk papan TV:
`GET /status-ruang` → `{ "Ruang Rapat Besar": true }`.

Status `meeting_minutes.status`: `DRAFT` (belum diproses) → `PROCESSING` → `DONE` / `FAILED`.

- Jika tahap notulen (LLM) gagal, status tetap `DONE`, transkrip tersimpan, dan `minutesError` terisi.
  Notulen bisa dibuat ulang lewat `/regenerate`.
- Jika proses dibatalkan, hasil sebelumnya (bila ada) tidak berubah.
- Notulen hasil AI selalu `minutesReviewed = false` (draf). Notulis menandainya sudah ditinjau saat
  menyimpan suntingan.
- Saat rapat dihapus dari Manajemen Rapat, file audio dan data notulennya ikut dihapus.

## Catatan

- **Perekaman di browser butuh HTTPS** (atau `localhost`). Browser memblokir mikrofon di
  `http://<ip>`. Unggah file tetap bisa lewat HTTP.
- Satu rapat bisa punya beberapa file. Setiap muat ulang halaman saat merekam akan memulai sesi
  (file) baru, dan saat diproses semua file disambung berurutan sesuai waktu dibuat.
