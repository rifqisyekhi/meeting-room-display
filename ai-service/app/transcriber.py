"""Speech-to-text dengan faster-whisper (CTranslate2). Model dimuat saat dibutuhkan dan
dapat dilepas dari memori setelah tahap transkripsi."""
from __future__ import annotations

import logging
import time
from collections.abc import Iterator

import numpy as np

from .config import Settings
from .memory import release_memory

log = logging.getLogger(__name__)

_MAX_PROMPT_CHARS = 600  # initial_prompt Whisper dibatasi ±224 token


def resolve_device(device: str) -> str:
    if device != "auto":
        return device
    try:
        import ctranslate2

        return "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    except Exception:  # noqa: BLE001
        return "cpu"


def build_initial_prompt(base: str, meeting: dict | None) -> str | None:
    """Prompt awal Whisper: teks dari .env + nama peserta/judul agar ejaan nama lebih tepat."""
    parts = [base.strip()] if base.strip() else []
    if meeting:
        if meeting.get("title"):
            parts.append(f"Rapat: {meeting['title']}.")
        if meeting.get("participants"):
            parts.append("Peserta: " + ", ".join(meeting["participants"]) + ".")
    text = " ".join(parts)
    return text[:_MAX_PROMPT_CHARS] or None


class Transcriber:
    def __init__(self, s: Settings):
        self.s = s
        self.model = None
        self.load_seconds = 0.0

    def load(self) -> None:
        if self.model is not None:
            return
        from faster_whisper import WhisperModel

        device = resolve_device(self.s.whisper_device)
        t0 = time.monotonic()
        log.info("Memuat model Whisper '%s' (device=%s, compute=%s, threads=%d)",
                 self.s.whisper_model, device, self.s.whisper_compute_type, self.s.whisper_cpu_threads)
        self.model = WhisperModel(
            self.s.whisper_model,
            device=device,
            compute_type=self.s.whisper_compute_type,
            cpu_threads=self.s.whisper_cpu_threads,
            num_workers=1,
            download_root=str(self.s.whisper_download_root),
        )
        self.load_seconds = time.monotonic() - t0
        log.info("Model Whisper dimuat dalam %.1f detik", self.load_seconds)

    def unload(self) -> None:
        if self.model is None:
            return
        del self.model
        self.model = None
        release_memory()
        log.info("Model Whisper dilepas dari memori")

    def transcribe(self, audio: np.ndarray, *, initial_prompt: str | None,
                   word_timestamps: bool) -> Iterator[dict]:
        """Transkripsi satu jendela audio; timestamp relatif terhadap awal jendela."""
        self.load()
        segments, _info = self.model.transcribe(  # type: ignore[union-attr]
            audio,
            language=self.s.whisper_language,
            task="transcribe",
            beam_size=self.s.whisper_beam_size,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": self.s.whisper_vad_min_silence_ms},
            # Wajib False untuk audio panjang: mencegah teks berulang/halusinasi berantai.
            condition_on_previous_text=False,
            initial_prompt=initial_prompt,
            word_timestamps=word_timestamps,
        )
        # Timestamp Whisper bisa sedikit melewati akhir jendela; batasi agar tidak tumpang tindih
        # dengan jendela berikutnya.
        limit = len(audio) / 16000
        for seg in segments:
            item = {"start": min(seg.start, limit), "end": min(seg.end, limit), "text": seg.text.strip()}
            if word_timestamps:
                item["words"] = [{"start": min(w.start, limit), "end": min(w.end, limit), "word": w.word}
                                 for w in (seg.words or [])]
            yield item
