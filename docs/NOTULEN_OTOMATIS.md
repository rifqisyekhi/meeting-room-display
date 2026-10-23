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

## Menjalankan di pengembangan

1. Service AI: lihat [ai-service/README.md](../ai-service/README.md). Pastikan `STORAGE_DIR` di
   `ai-service/.env` sama dengan `NOTULEN_STORAGE_DIR` di `backend/.env` (default
   `backend/data/notulen`, cukup `STORAGE_DIR=../backend/data/notulen`).
2. Ollama: `ollama pull qwen3:4b`.
3. Backend seperti biasa (`npm run dev`). Tabel `meeting_audio_files` dan `meeting_minutes` dibuat
   otomatis saat backend menyala.
4. Fitur ini **butuh PostgreSQL**. Di mode fallback file JSON, semua rute notulen menjawab 503.

## Variabel `backend/.env`

| Variabel | Default | Keterangan |
|---|---|---|
| `AI_SERVICE_URL` | `http://127.0.0.1:8000` | Service AI lokal. Jangan arahkan ke layanan cloud. |
| `AI_SERVICE_TOKEN` | kosong | Sama dengan `API_TOKEN` di `ai-service/.env`. Wajib diisi di server. |
| `NOTULEN_STORAGE_DIR` | `backend/data/notulen` | Folder audio rapat (masuk `.gitignore`). |
| `NOTULEN_MAX_UPLOAD_MB` | `2048` | Batas ukuran unggahan file audio. |

## API backend (`/api/notulen`, semua khusus peran Admin)

`:id` = ID rapat (boleh ID Google Calendar). Respons berformat `{ success, ... }` atau
`{ success: false, error }` dengan pesan berbahasa Indonesia.

| Method | Path | Fungsi |
|---|---|---|
| GET | `/status-ai` | Status service AI (RAM, model, antrean, Ollama) |
| GET | `/meetings/:id` | Data rapat + daftar file audio + transkrip + notulen |
| GET | `/meetings/:id/status` | Status ringan untuk polling progress |
| POST | `/meetings/:id/recordings` | Mulai sesi rekam baru → `{ file.id }`. Body: `{ mimeType }` |
| PUT | `/meetings/:id/recordings/:fileId/chunks/:seq` | Kirim potongan ke-`seq` (body biner). Idempoten: seq lama diabaikan, seq meloncat → 409 + `expectedSeq` |
| POST | `/meetings/:id/recordings/:fileId/finish` | Tandai rekaman selesai |
| POST | `/meetings/:id/audio` | Unggah file (body biner, dialirkan ke disk). Header `X-File-Name` (URL-encoded), `X-File-Type` |
| GET | `/meetings/:id/audio/:fileId` | Putar/unduh file audio (mendukung Range) |
| DELETE | `/meetings/:id/audio/:fileId` | Hapus file audio (ditolak saat sedang diproses) |
| POST | `/meetings/:id/process` | Proses semua file berurutan. Body: `{ numSpeakers?, diarization?, summarize? }` |
| POST | `/meetings/:id/regenerate` | Buat ulang notulen dari transkrip + nama pembicara |
| POST | `/meetings/:id/cancel` | Batalkan proses yang berjalan |
| PUT | `/meetings/:id/speakers` | `{ speakers: { "SPEAKER_1": "Pak Budi" } }` |
| PUT | `/meetings/:id/minutes` | `{ markdown, reviewed }`: simpan hasil sunting notulis |
| GET | `/meetings/:id/minutes.md` | Unduh notulen `.md` |

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
