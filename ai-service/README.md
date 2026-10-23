# Service AI Notulensi (lokal, tanpa cloud)

Service Python (FastAPI) yang mengubah rekaman rapat menjadi **transkrip** dan **draf notulen** untuk
fitur *Notulen Otomatis* di menu Manajemen Rapat (Admin). Yang memanggil service ini adalah backend Express
(`backend/src/services/notulen.service.js`); browser tidak pernah mengaksesnya langsung. Seluruh
pemrosesan berjalan di server sendiri:

| Tahap | Teknologi | Keterangan |
|---|---|---|
| Speech-to-text | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (model OpenAI Whisper, MIT) | `language="id"`, VAD aktif, `condition_on_previous_text=False` |
| Pemisahan pembicara (opsional) | sherpa-onnx (segmentasi pyannote-3.0 + embedding 3D-Speaker, ONNX) | tanpa torch & tanpa token; default **mati** |
| Notulen | Ollama lokal (`qwen3:4b` default) | peringkasan bertingkat (map-reduce) |

Internet hanya dipakai saat instalasi & unduh model pertama kali. Setelah itu aktifkan
`HF_HUB_OFFLINE=true`.

---

## Cara kerja singkat

```
Express ──POST /jobs──▶ API (127.0.0.1:8000) ──SQLite──▶ Worker (1 proses, nice 10)
                                                          │
          1. Membaca audio  (cek file & durasi)           │
          2. Transkripsi    (per file, per jendela 10 mnt) │ model Whisper dimuat
             └ model Whisper DILEPAS (del + gc)            │
          3. Pemisahan pembicara (jika aktif)              │
          4. Notulen (Ollama, map-reduce)                  │ model LLM dilepas (keep_alive=0)
```

Prinsip hemat memori & CPU:

- **Satu job dalam satu waktu.** Job lain menunggu di antrean (status tersimpan di `data/jobs.sqlite3`).
- **Tahapan bergantian, tidak bersamaan.** Whisper dilepas dari RAM sebelum diarization/LLM berjalan.
- **Audio tidak pernah dimuat utuh.** Tiap file didekode per jendela ±10 menit (`AUDIO_WINDOW_SECONDS`)
  dan dipotong di titik paling hening. Rapat 6 jam memakai RAM yang sama dengan rapat 10 menit.
  Timestamp file berikutnya diberi offset sebesar durasi file sebelumnya.
- **CPU dibatasi.** `WHISPER_CPU_THREADS=3` (dari 4 vCPU) dan `OLLAMA_NUM_THREAD=3`. Worker berjalan
  dengan prioritas rendah (nice 10, I/O best-effort 7).
- **Cek RAM sebelum mulai.** Job ditolak dengan pesan jelas jika RAM bebas di bawah ambang
  (`WHISPER_MIN_FREE_RAM_MB`, `LLM_MIN_FREE_RAM_MB`, `DIARIZATION_MIN_FREE_RAM_MB`). Di Linux, batas
  `MemoryMax` systemd (cgroup) ikut diperhitungkan.
- **Tahan crash.** Worker adalah proses terpisah. Jika dibunuh OOM killer, API tetap hidup, job ditandai
  gagal, lalu worker baru dinyalakan. Jika service di-restart, job yang terputus diantrekan ulang
  (maksimal `JOB_MAX_ATTEMPTS`), dan file yang sudah selesai ditranskripsi tidak diulang.
- **Transkrip aman walau LLM gagal.** Jika Ollama mati atau kehabisan RAM, job tetap `done` dengan
  `minutes_markdown=null` + `minutes_error`. Notulen bisa dibuat ulang dengan job `type=summarize`.

---

## 1. Instalasi di Windows 11 (pengembangan)

Kebutuhan: Python 3.11 (via `uv`), ±3 GB disk untuk model. ffmpeg **tidak** diperlukan, karena PyAV
sudah menyertakan dekoder audio.

```powershell
# sekali saja: pasang uv (pengelola Python & paket)
python -m pip install --user uv          # atau: winget install astral-sh.uv

cd D:\Sakeh\Project\meeting-room-display\ai-service
python -m uv venv --python 3.11 .venv     # uv otomatis mengunduh Python 3.11 bila belum ada
python -m uv pip install --python .venv\Scripts\python.exe -r requirements.txt

copy .env.example .env                    # lalu sesuaikan bila perlu
.venv\Scripts\python.exe scripts\download_models.py   # unduh model Whisper sesuai .env
.venv\Scripts\python.exe -m app            # jalankan service
```

Buka http://127.0.0.1:8000/docs.

Ollama untuk Windows: unduh dari https://ollama.com/download, lalu jalankan `ollama pull qwen3:4b`.

## 2. Instalasi di Ubuntu 24.04 (server)

Ubuntu 24.04 membawa Python **3.12**. Python 3.11 dipasang lewat `uv`, jadi tidak mengganggu Python sistem.

```bash
sudo apt update && sudo apt install -y curl
sudo useradd --system --create-home --home-dir /srv/notulensi --shell /usr/sbin/nologin notulensi
# salin folder project ke /srv/notulensi/app (git clone / rsync), lalu:
sudo chown -R notulensi:notulensi /srv/notulensi

sudo -u notulensi -H bash -c '
  curl -LsSf https://astral.sh/uv/install.sh | sh
  cd /srv/notulensi/app/ai-service
  ~/.local/bin/uv venv --python 3.11 .venv
  ~/.local/bin/uv pip install --python .venv/bin/python -r requirements.txt
  cp .env.example .env
'
# STORAGE_DIR di .env HARUS sama dengan NOTULEN_STORAGE_DIR di backend/.env (default: backend/data/notulen)
sudo -u notulensi -H /srv/notulensi/app/ai-service/.venv/bin/python /srv/notulensi/app/ai-service/scripts/download_models.py
```

**Ollama** (bind default 127.0.0.1:11434, tidak terbuka ke jaringan):

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3:4b
# Hemat RAM: hanya satu model & satu permintaan sekaligus
sudo systemctl edit ollama
#   [Service]
#   Environment="OLLAMA_HOST=127.0.0.1:11434"
#   Environment="OLLAMA_MAX_LOADED_MODELS=1"
#   Environment="OLLAMA_NUM_PARALLEL=1"
#   Nice=10
sudo systemctl restart ollama
```

Uji jalan manual: `sudo -u notulensi /srv/notulensi/app/ai-service/.venv/bin/python -m app`
(dari folder `ai-service`). Unit systemd lengkap (dengan `Nice=10`, `MemoryMax`), Nginx, dan ufw dibahas
di tahap deploy (tahap 4).

### Mode offline

Setelah semua model terunduh (`scripts/download_models.py`, `ollama pull`), set di `.env`:

```
HF_HUB_OFFLINE=true
```

Model Whisper ada di `ai-service/models/`, model pemisahan pembicara di `ai-service/models/diarization/`. Folder
ini bisa disalin ke server lain yang tidak punya internet.

---

## 3. Uji cepat lewat http://127.0.0.1:8000/docs

1. Letakkan satu file audio pendek (1–5 menit) di dalam folder storage, misalnya
   `D:\Sakeh\Project\meeting-room-display\backend\data\notulen\_uji\contoh.m4a`.
2. **GET /health** → *Try it out* → *Execute*. Pastikan `worker_alive: true`,
   `ram.enough_for_whisper: true`, dan `ollama.reachable: true`.
3. **POST /jobs** → *Try it out*, isi body (path **absolut**, garis miring `/` juga boleh di Windows):

   ```json
   {
     "audio_files": ["D:/Sakeh/Project/meeting-room-display/backend/data/notulen/_uji/contoh.m4a"],
     "meeting": {
       "title": "Rapat Koordinasi Anggaran",
       "datetime": "2026-10-23T09:00:00",
       "location": "Ruang Rapat Lt. 2",
       "participants": ["Pak Budi", "Ibu Sari"],
       "agenda": "Pengadaan laptop; pelatihan pegawai"
     }
   }
   ```

   Salin `id` dari respons.
4. **GET /jobs/{id}** → ulangi *Execute* untuk memantau `status`, `stage_label`, `progress`, dan
   `eta_seconds`. Setelah `status: "done"`, lihat `result.transcript.segments` dan
   `result.minutes_markdown`.
5. Buat ulang notulen dengan nama pembicara: **POST /jobs** dengan `type: "summarize"`, isi
   `segments` dari hasil sebelumnya, dan `speaker_names` seperti `{"SPEAKER_1": "Pak Budi"}`.

Pada percobaan pertama, tahap transkripsi terlihat diam di 0% selama model diunduh/dimuat. Ini normal.

### Ringkasan API

| Method | Path | Fungsi |
|---|---|---|
| GET | `/health` | status worker, RAM tersedia & ambang, konfigurasi model, status Ollama, antrean |
| POST | `/jobs` | buat job `transcribe` (audio → transkrip → notulen) atau `summarize` (transkrip → notulen) |
| GET | `/jobs/{id}?include_result=false` | status untuk polling: `status`, `stage`, `stage_label`, `progress` (0–1), `stage_progress`, `eta_seconds`, `queue_position`, `warnings`, `error` |
| GET | `/jobs/{id}` | sama, plus `result` |
| POST | `/jobs/{id}/cancel` | batalkan job (antre: langsung; berjalan: berhenti dalam beberapa detik) |
| DELETE | `/jobs/{id}` | hapus job yang sudah selesai (setelah hasilnya disalin ke database backend) |

`status`: `queued` → `running` → `done` / `failed` / `cancelled`.
`stage`: `reading_audio` → `transcribing` → `diarizing` → `summarizing`.

Isi `result` untuk `transcribe`:

```jsonc
{
  "transcript": {
    "segments": [{"start": 0.0, "end": 9.4, "speaker": "SPEAKER_1" /* atau null */, "text": "..."}],
    "files": [{"path": "...", "offset": 0.0, "duration": 1800.2}],
    "duration_seconds": 1800.2, "language": "id", "whisper_model": "small",
    "diarization": false, "speakers": []
  },
  "minutes_markdown": "# Notulen Rapat: ...",   // null jika tahap LLM gagal
  "minutes_error": null,                         // pesan jika tahap LLM gagal
  "llm_model": "qwen3:4b",
  "timings": {"transcription_seconds": 812.4, "summary_seconds": 240.1}
}
```

Jika `API_TOKEN` diisi di `.env`, semua endpoint kecuali `/health` wajib mengirim header `X-API-Key`.

---

## 4. Memilih konfigurasi (cukup ubah `.env`)

| Kondisi server | `WHISPER_MODEL` | `WHISPER_DEVICE` / `COMPUTE_TYPE` | `WHISPER_CPU_THREADS` | `OLLAMA_MODEL` |
|---|---|---|---|---|
| Sekarang: 4 vCPU, RAM bebas ±4,8 GB | `small` | `cpu` / `int8` | `3` | `qwen3:4b` |
| Upgrade: 8–16 vCPU, RAM 32 GB | `turbo` | `cpu` / `int8` | jumlah vCPU − 2 | `qwen3:8b` |
| Ada GPU NVIDIA (16 GB+) | `turbo` atau `large-v3` | `cuda` / `float16` | (tidak berpengaruh) | `qwen3:14b` |

- Model berakhiran `.en` dan `distil-*` (khusus bahasa Inggris) **ditolak** saat service start.
- `tiny`/`base` diizinkan, tetapi muncul peringatan di log karena akurasi bahasa Indonesia rendah.
- Isi `WHISPER_INITIAL_PROMPT` dengan istilah dan nama khas instansi (singkatan unit, nama aplikasi, dsb.).
  Judul rapat dan nama peserta otomatis ditambahkan ke prompt ini per job.
- **GPU:** CTranslate2 4.8 memerlukan CUDA 12 + cuDNN 9. Cara termudah:
  `uv pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.*`, lalu tambahkan folder `lib` keduanya ke
  `LD_LIBRARY_PATH`.

**Perkiraan waktu** di server sekarang (belum diukur di server, jalankan benchmark untuk angka pasti):
di laptop pengembangan (Core Ultra 5 125U, 3 thread), `small` int8 mencapai RTF ±0,34–0,46, yaitu
±2–3 jam untuk rapat 6 jam. Tahap notulen dengan `qwen3:4b` di CPU kira-kira 2–3 menit per potongan
12.000 karakter (rapat 6 jam ≈ 15–20 potongan).

---

## 5. Pemisahan pembicara (opsional)

Memakai **sherpa-onnx** (cara yang sama dengan aplikasi OnTheRecord): segmentasi pyannote-3.0 dan
embedding 3D-Speaker dalam format ONNX. Tidak butuh torch dan tidak butuh token Hugging Face. Paketnya
sudah ada di `requirements.txt`, dan modelnya hanya ±40 MB.

```bash
python scripts/download_models.py --diarization     # unduh model sekali (saat online)
# lalu di .env:
ENABLE_DIARIZATION=true
```

Cara kerjanya:

1. Semua file rapat didekode sekali menjadi satu file float32 sementara di disk (`data/tmp`,
   ±230 MB per jam audio, dihapus setelah job selesai).
2. Whisper berjalan dengan `word_timestamps=True`, membaca file itu per jendela lewat `np.memmap`.
3. Model Whisper dilepas, lalu sherpa-onnx menentukan "siapa bicara kapan".
4. Setiap kata diberi label pembicara (overlap terbesar), dan kata berurutan dari pembicara yang sama
   digabung menjadi satu ucapan. Label: `SPEAKER_1`, `SPEAKER_2`, … sesuai urutan kemunculan.
5. Pembicara dengan porsi bicara sangat kecil (< 2% dan < 20 detik, biasanya derau, tawa, atau suara
   tumpang tindih) digabung ke pembicara utama terdekat.

> ⚠️ **Kebutuhan sumber daya** (diukur di laptop pengembangan, 3 thread):
>
> | Audio | Waktu diarization | Puncak RAM |
> |---|---|---|
> | 30 menit | 7,5 menit (0,25×) | ±625 MB |
> | 60 menit | 18,5 menit (0,30×) | ±870 MB |
>
> sherpa-onnx memuat seluruh audio dan hasil antaranya ke RAM, jadi kebutuhannya tumbuh **±0,5 GB per
> jam audio**. Rapat 6 jam ≈ **3,3 GB** dan ±1,8 jam tambahan. Sebelum mulai, worker memeriksa RAM
> bebas ≥ `DIARIZATION_MIN_FREE_RAM_MB` + `DIARIZATION_RAM_MB_PER_HOUR` × durasi. Jika kurang,
> transkrip tetap disimpan tanpa label pembicara, disertai peringatan. Di server sekarang (RAM bebas
> ±4,8 GB, dipakai bersama), diarization aman untuk rapat ±3–4 jam. Untuk rapat lebih panjang,
> matikan per rapat atau tambah RAM.

Isi **jumlah pembicara** per rapat (`options.num_speakers`) bila sudah diketahui, agar hasilnya lebih
stabil. Jika tidak diisi, jumlahnya ditebak dari `DIARIZATION_THRESHOLD` (lebih kecil = lebih banyak
pembicara). Diarization bisa dimatikan per job dengan `options.diarization=false`. Jika diarization
gagal (misalnya RAM kurang), transkrip tetap disimpan tanpa label pembicara dan muncul peringatan.

---

## 6. Benchmark model (`scripts/benchmark.py`)

Gunakan rekaman rapat asli berdurasi 2–10 menit (sebaiknya disertai transkrip acuan ketikan manusia):

```bash
# Windows: .venv\Scripts\python.exe   |   Ubuntu: .venv/bin/python
python scripts/benchmark.py contoh.m4a                                   # small, medium, turbo
python scripts/benchmark.py contoh.m4a --models small,turbo --reference acuan.txt
python scripts/benchmark.py contoh.m4a --threads 3 --beam-size 1         # uji pengaturan lebih cepat
```

Output: waktu muat model, waktu proses, **RTF** (detik proses per detik audio; RTF 0,5 berarti rapat
6 jam selesai ±3 jam), **puncak RAM**, dan **WER** jika ada `--reference`. Teks tiap model disimpan di
`benchmark-results/<model>.txt` untuk dibandingkan, ringkasan di `results.json`. Tiap model dijalankan
di proses terpisah agar angka RAM tidak tercampur.

Jalankan di server saat beban layanan lain rendah. Ingat: `turbo` memerlukan ±2–2,5 GB RAM.

---

## 7. Struktur folder

```
ai-service/
├── app/
│   ├── main.py         # FastAPI: /health, /jobs + supervisor proses worker
│   ├── worker.py       # pipeline: membaca audio → transkripsi → diarization → notulen
│   ├── jobs.py         # antrean & status job (SQLite, tahan restart)
│   ├── audio.py        # validasi path (anti path traversal), durasi, dekode bertahap
│   ├── transcriber.py  # faster-whisper (muat/lepas model)
│   ├── diarizer.py     # sherpa-onnx (opsional, impor malas)
│   ├── summarizer.py   # klien Ollama + map-reduce
│   ├── prompts.py      # prompt notulen (bahasa Indonesia), ubah di sini
│   ├── textproc.py     # label pembicara per kata, format [hh:mm:ss], pemotongan
│   ├── memory.py       # cek RAM (termasuk cgroup)
│   └── config.py       # semua pengaturan dari .env
├── scripts/
│   ├── benchmark.py
│   └── download_models.py
├── requirements.txt
└── .env.example
```

## 8. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| `POST /jobs` → 503 "RAM tersedia hanya …" | RAM bebas di bawah ambang. Tunggu, pakai model lebih kecil, atau sesuaikan `WHISPER_MIN_FREE_RAM_MB`. |
| `minutes_error`: "Ollama tidak dapat dihubungi" | Jalankan Ollama (`systemctl status ollama`). Buat ulang notulen dengan `type=summarize`. |
| `minutes_error`: "Model … belum tersedia" | `ollama pull qwen3:4b` |
| Job gagal "Proses worker berhenti tiba-tiba (exit code -9)" | Dibunuh OOM killer. Pakai model lebih kecil atau naikkan `MemoryMax`/RAM VM. |
| Teks berulang-ulang | Pastikan memakai versi ini (`condition_on_previous_text=False`). Coba `WHISPER_BEAM_SIZE=5`. |
| Nama/istilah sering salah eja | Tambahkan ke `WHISPER_INITIAL_PROMPT`, isi daftar peserta di data rapat. |
| Server lain jadi lambat | Turunkan `WHISPER_CPU_THREADS` dan `OLLAMA_NUM_THREAD` (mis. 2), naikkan `WORKER_NICE` (maks. 19). |
