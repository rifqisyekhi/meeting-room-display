# Deploy Notulen Otomatis ke Server Ubuntu 24.04

Panduan ini menambahkan fitur notulen ke server tempat Meeting Room Display sudah berjalan
(backend Express via pm2, PostgreSQL). Target: VM 4 vCPU, RAM bebas ±4,8 GB yang dipakai bersama
layanan lain. Contoh di bawah memakai:

- repo di `/srv/meeting-room-display`
- user Linux `meetingroom`, yaitu user yang menjalankan backend (pm2)

Sesuaikan kedua nilai itu dengan kondisi server.

> Semua AI berjalan lokal. Internet hanya dipakai saat instalasi dan unduh model. Setelah itu aktifkan
> mode offline (langkah 6).

## 1. Paket sistem

```bash
sudo apt update
sudo apt install -y nginx curl ufw
```

ffmpeg tidak diperlukan. Dekoder audio sudah ikut di paket Python `av`.

## 2. Service AI

```bash
sudo -u meetingroom -H bash -c '
  curl -LsSf https://astral.sh/uv/install.sh | sh
  cd /srv/meeting-room-display/ai-service
  ~/.local/bin/uv venv --python 3.11 .venv          # Ubuntu 24.04 bawaannya Python 3.12
  ~/.local/bin/uv pip install --python .venv/bin/python -r requirements.txt
  cp .env.example .env
'
```

Sunting `ai-service/.env`:

```ini
STORAGE_DIR=/srv/meeting-room-display/backend/data/notulen
API_TOKEN=<string acak panjang>          # buat: openssl rand -hex 32
WHISPER_MODEL=small                      # setelah upgrade RAM 32 GB: turbo
WHISPER_CPU_THREADS=3
OLLAMA_NUM_THREAD=3
ENABLE_DIARIZATION=false                 # aktifkan setelah diuji (lihat ai-service/README.md bagian 5)
```

Unduh model (perlu internet):

```bash
cd /srv/meeting-room-display/ai-service
sudo -u meetingroom .venv/bin/python scripts/download_models.py --diarization
```

Pasang sebagai service systemd (Nice=10, MemoryMax, CPUWeight rendah):

```bash
sudo cp deploy/notulen-ai.service /etc/systemd/system/     # sunting User/Group & path dulu
sudo systemctl daemon-reload
sudo systemctl enable --now notulen-ai
curl -s http://127.0.0.1:8000/health | python3 -m json.tool
```

## 3. Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3:4b                     # RAM 32 GB: qwen3:8b · GPU 16 GB+: qwen3:14b
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo cp deploy/ollama-override.conf /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

## 4. Backend

Tambahkan ke `backend/.env`:

```ini
AI_SERVICE_URL=http://127.0.0.1:8000
AI_SERVICE_TOKEN=<sama dengan API_TOKEN di ai-service/.env>
NOTULEN_STORAGE_DIR=/srv/meeting-room-display/backend/data/notulen
NOTULEN_MAX_UPLOAD_MB=2048
```

```bash
sudo -u meetingroom mkdir -p /srv/meeting-room-display/backend/data/notulen
sudo chmod 700 /srv/meeting-room-display/backend/data/notulen    # audio rahasia
pm2 restart <nama-proses-backend>
```

Tabel `meeting_audio_files` dan `meeting_minutes` dibuat otomatis saat backend menyala.

## 5. Frontend + Nginx + HTTPS

**HTTPS wajib untuk fitur rekam**, karena browser memblokir mikrofon di `http://<ip>`.

```bash
cd /srv/meeting-room-display/frontend && npm ci && npm run build

# Sertifikat self-signed (ganti IP/nama host server)
sudo mkdir -p /etc/ssl/meeting-room
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout /etc/ssl/meeting-room/meeting-room.key -out /etc/ssl/meeting-room/meeting-room.crt \
  -subj "/CN=meeting-room" -addext "subjectAltName=IP:192.168.x.x,DNS:meeting-room.local"

sudo cp deploy/nginx-meeting-room.conf /etc/nginx/sites-available/meeting-room
sudo ln -s /etc/nginx/sites-available/meeting-room /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Agar browser tidak menampilkan peringatan sertifikat, pasang `meeting-room.crt` sebagai *trusted root*
di laptop admin (Windows: `certmgr.msc` → Trusted Root Certification Authorities → Import), atau
minta sertifikat dari CA internal instansi.

## 6. Firewall & mode offline

```bash
sudo ufw default deny incoming
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ss -ltnp | grep -E ':8000|:11434|:3001'   # harus 127.0.0.1 (3001 boleh, tidak dibuka ufw)
```

Port 3001 (backend), 8000 (service AI), dan 11434 (Ollama) **tidak** dibuka di ufw. Hanya nginx
yang menghadap jaringan.

Setelah semua model terunduh, set `HF_HUB_OFFLINE=true` di `ai-service/.env` lalu
`sudo systemctl restart notulen-ai`. Service tidak akan mengakses internet lagi.

## 7. Cek akhir

1. Login sebagai Admin → Manajemen Rapat → tombol **🎙 Notulen** pada salah satu rapat.
2. Chip status di kanan atas harus menampilkan "Service AI aktif".
3. Unggah audio pendek → **Proses sekarang** → tunggu transkrip dan notulen.
4. Coba **Rekam** beberapa menit lewat HTTPS.
5. Jalankan benchmark untuk memilih model:
   `sudo -u meetingroom ai-service/.venv/bin/python ai-service/scripts/benchmark.py rekaman.m4a`.

## Pemantauan

```bash
journalctl -u notulen-ai -f          # log service AI & worker
systemctl status notulen-ai ollama
curl -s http://127.0.0.1:8000/health # RAM tersedia, antrean, status Ollama
```
