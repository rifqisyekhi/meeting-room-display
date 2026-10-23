"""Konfigurasi service AI. Semua nilai dibaca dari environment / file .env.

Ubah perilaku (ukuran model, thread, device, ambang RAM, dsb.) cukup lewat .env,
tidak perlu mengubah kode.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger(__name__)

SERVICE_DIR = Path(__file__).resolve().parent.parent

# Model Whisper yang khusus bahasa Inggris. Distil-Whisper seluruhnya hanya dilatih bahasa Inggris.
_ENGLISH_ONLY_HINT = (
    "Model '{name}' hanya mendukung bahasa Inggris dan tidak bisa dipakai untuk rapat berbahasa "
    "Indonesia. Ganti WHISPER_MODEL di .env menjadi model multibahasa, misalnya: small, medium, "
    "turbo (large-v3-turbo), atau large-v3."
)
_LOW_ACCURACY_MODELS = {"tiny", "base"}

# Perkiraan kebutuhan RAM (MB) per model untuk CPU int8, termasuk buffer audio & overhead.
# Bisa ditimpa dengan WHISPER_MIN_FREE_RAM_MB.
_WHISPER_RAM_MB = {
    "tiny": 600,
    "base": 800,
    "small": 1200,
    "medium": 2400,
    "turbo": 2400,
    "large-v3-turbo": 2400,
    "large-v1": 4000,
    "large-v2": 4000,
    "large-v3": 4000,
    "large": 4000,
}


def check_whisper_model_name(name: str) -> None:
    """Tolak model khusus bahasa Inggris; peringatkan model yang akurasinya rendah."""
    base = Path(name.rstrip("/\\")).name.lower()
    if base.endswith(".en") or "distil" in base:
        raise ValueError(_ENGLISH_ONLY_HINT.format(name=name))
    if base in _LOW_ACCURACY_MODELS:
        log.warning(
            "WHISPER_MODEL=%s: akurasi untuk bahasa Indonesia rendah. Gunakan minimal 'small' "
            "(disarankan 'turbo' bila RAM cukup).",
            name,
        )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(SERVICE_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    # --- Server ---
    host: str = "127.0.0.1"
    port: int = 8000
    # Jika diisi, setiap request (kecuali /health) wajib membawa header X-API-Key.
    api_token: str = ""
    log_level: str = "INFO"

    # --- Penyimpanan ---
    # Folder bersama dengan aplikasi Next.js. Service hanya boleh membaca file di dalamnya.
    storage_dir: Path = SERVICE_DIR.parent / "storage"
    # Folder kerja service (database job, file sementara).
    data_dir: Path = SERVICE_DIR / "data"
    allowed_audio_extensions: str = ".webm,.ogg,.oga,.opus,.mp3,.m4a,.mp4,.aac,.wav,.flac,.mkv"

    # --- Whisper ---
    whisper_model: str = "small"
    whisper_device: str = "cpu"  # cpu | cuda | auto
    whisper_compute_type: str = "int8"  # cpu: int8 | cuda: float16 / int8_float16
    whisper_cpu_threads: int = 3
    whisper_download_root: Path = SERVICE_DIR / "models"
    whisper_language: str = "id"
    whisper_beam_size: int = 5
    whisper_initial_prompt: str = (
        "Notulen rapat dinas dalam bahasa Indonesia. Pembahasan agenda, keputusan, "
        "dan tindak lanjut oleh peserta rapat."
    )
    whisper_vad_min_silence_ms: int = 500
    # Lepas model Whisper dari memori setelah tahap transkripsi (sebelum LLM dipanggil).
    whisper_unload_after_job: bool = True
    # Audio didekode & ditranskripsi per jendela agar RAM tidak tumbuh mengikuti durasi rapat.
    audio_window_seconds: int = 600
    # 0 = otomatis dari tabel perkiraan per model.
    whisper_min_free_ram_mb: int = 0

    # --- Diarization (sherpa-onnx, tanpa torch & tanpa token HF) ---
    enable_diarization: bool = False
    diarization_segmentation_url: str = (
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/"
        "sherpa-onnx-pyannote-segmentation-3-0.tar.bz2"
    )
    diarization_embedding_url: str = (
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/"
        "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
    )
    # Lebih kecil = lebih banyak pembicara terdeteksi (dipakai bila jumlah pembicara tidak diisi).
    diarization_threshold: float = 0.85
    # Pembicara dengan porsi bicara di bawah ini digabung ke pembicara utama terdekat.
    diarization_min_speaker_share: float = 0.02
    diarization_min_speaker_seconds: float = 20
    # sherpa-onnx memuat seluruh audio + hasil antara ke RAM: kebutuhan tumbuh mengikuti durasi.
    # Diukur: 30 mnt ≈ 625 MB, 60 mnt ≈ 870 MB → dasar 500 MB + 500 MB per jam audio.
    diarization_min_free_ram_mb: int = 500
    diarization_ram_mb_per_hour: int = 500
    # Jeda maksimum (detik) antar kata pembicara yang sama agar tetap satu ucapan.
    speaker_merge_gap_seconds: float = 1.5

    # --- Hugging Face (unduhan model) ---
    # Cache Hugging Face (model Whisper diunduh dari sini). Isi HF_HUB_OFFLINE=true setelah semua
    # model terunduh; model diarization juga tidak akan diunduh lagi.
    hf_home: Path = SERVICE_DIR / "models" / "hf"
    hf_hub_offline: bool = False

    # --- Worker ---
    worker_nice: int = 10
    job_max_attempts: int = 3
    worker_poll_seconds: float = 1.0

    # --- LLM (Ollama) ---
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen3:4b"
    # keep_alive setelah job selesai. "0" = model langsung dilepas dari RAM.
    ollama_keep_alive: str = "0"
    # keep_alive di antara panggilan dalam satu job (agar model tidak dimuat ulang tiap potongan).
    ollama_keep_alive_in_job: str = "5m"
    ollama_num_ctx: int = 8192
    ollama_num_predict: int = 4096
    ollama_num_thread: int = 3
    ollama_temperature: float = 0.2
    ollama_timeout_seconds: float = 1800
    llm_min_free_ram_mb: int = 3500
    summary_chunk_chars: int = 12000
    # Batas panjang gabungan catatan sebelum disusun menjadi notulen akhir.
    summary_reduce_max_chars: int = 12000

    @field_validator("whisper_model")
    @classmethod
    def _validate_model(cls, v: str) -> str:
        v = v.strip()
        check_whisper_model_name(v)
        return v

    @field_validator("whisper_device")
    @classmethod
    def _validate_device(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"cpu", "cuda", "auto"}:
            raise ValueError("Device harus salah satu dari: cpu, cuda, auto")
        return v

    @field_validator("storage_dir", "data_dir", "whisper_download_root", "hf_home")
    @classmethod
    def _absolute(cls, v: Path) -> Path:
        return (v if v.is_absolute() else SERVICE_DIR / v).resolve()

    @property
    def audio_extensions(self) -> set[str]:
        return {e.strip().lower() for e in self.allowed_audio_extensions.split(",") if e.strip()}

    @property
    def jobs_db_path(self) -> Path:
        return self.data_dir / "jobs.sqlite3"

    @property
    def tmp_dir(self) -> Path:
        return self.data_dir / "tmp"

    def whisper_required_ram_mb(self) -> int:
        if self.whisper_min_free_ram_mb > 0:
            return self.whisper_min_free_ram_mb
        return _WHISPER_RAM_MB.get(Path(self.whisper_model).name.lower(), 2400)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.data_dir.mkdir(parents=True, exist_ok=True)
    s.tmp_dir.mkdir(parents=True, exist_ok=True)
    s.whisper_download_root.mkdir(parents=True, exist_ok=True)
    # huggingface_hub membaca konfigurasi dari environment proses (diwarisi proses worker).
    os.environ.setdefault("HF_HOME", str(s.hf_home))
    if s.hf_hub_offline:
        os.environ["HF_HUB_OFFLINE"] = "1"
    return s
