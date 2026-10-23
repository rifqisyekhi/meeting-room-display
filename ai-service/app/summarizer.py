"""Penyusunan notulen dengan peringkasan bertingkat (map-reduce) memakai Ollama lokal."""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import datetime

import httpx

from . import prompts
from .config import Settings
from .textproc import chunk_lines, clean_llm_output, transcript_lines

log = logging.getLogger(__name__)

_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
          "September", "Oktober", "November", "Desember"]


class LLMError(RuntimeError):
    pass


def format_datetime_id(value: str | None) -> str:
    if not value:
        return "-"
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value  # sudah berupa teks tampilan
    s = f"{_HARI[dt.weekday()]}, {dt.day} {_BULAN[dt.month - 1]} {dt.year}"
    if (dt.hour, dt.minute) != (0, 0):
        s += f", pukul {dt.hour:02d}.{dt.minute:02d}"
    return s


def minutes_header(meeting: dict) -> str:
    lines = [f"# Notulen Rapat: {meeting.get('title') or '-'}", ""]
    lines.append(f"- **Tanggal/waktu:** {meeting.get('datetime_display') or format_datetime_id(meeting.get('datetime'))}")
    lines.append(f"- **Tempat:** {meeting.get('location') or '-'}")
    participants = meeting.get("participants") or []
    lines.append(f"- **Peserta:** {', '.join(participants) if participants else '-'}")
    if meeting.get("agenda"):
        lines.append(f"- **Agenda:** {meeting['agenda']}")
    return "\n".join(lines)


class OllamaClient:
    def __init__(self, s: Settings):
        self.s = s
        self.http = httpx.Client(base_url=s.ollama_url, timeout=httpx.Timeout(s.ollama_timeout_seconds, connect=10))

    def chat(self, user: str, keep_alive: str) -> str:
        body = {
            "model": self.s.ollama_model,
            "messages": [{"role": "system", "content": prompts.SYSTEM},
                         {"role": "user", "content": user}],
            "stream": False,
            "think": False,
            "keep_alive": keep_alive,
            "options": {
                "num_ctx": self.s.ollama_num_ctx,
                "num_predict": self.s.ollama_num_predict,
                "num_thread": self.s.ollama_num_thread,
                "temperature": self.s.ollama_temperature,
            },
        }
        last_err: Exception | None = None
        for attempt in range(2):
            try:
                r = self.http.post("/api/chat", json=body)
            except httpx.ConnectError as e:
                raise LLMError(
                    f"Ollama tidak dapat dihubungi di {self.s.ollama_url}. Pastikan layanan Ollama berjalan."
                ) from e
            except httpx.TimeoutException as e:
                raise LLMError(
                    f"Ollama tidak merespons dalam {self.s.ollama_timeout_seconds:.0f} detik "
                    "(OLLAMA_TIMEOUT_SECONDS). Coba model yang lebih kecil atau naikkan batas waktu."
                ) from e
            if r.status_code == 404:
                raise LLMError(
                    f"Model '{self.s.ollama_model}' belum tersedia di Ollama. Jalankan: ollama pull {self.s.ollama_model}"
                )
            if r.status_code >= 400:
                try:
                    detail = r.json().get("error", r.text)
                except ValueError:
                    detail = r.text
                if "memory" in detail.lower():
                    raise LLMError(f"Ollama kehabisan memori: {detail}. Gunakan model yang lebih kecil "
                                   "atau kurangi OLLAMA_NUM_CTX.")
                last_err = LLMError(f"Ollama mengembalikan error {r.status_code}: {detail}")
                time.sleep(3)
                continue
            content = clean_llm_output(r.json().get("message", {}).get("content", ""))
            if content:
                return content
            last_err = LLMError("Ollama mengembalikan jawaban kosong.")
        raise last_err  # type: ignore[misc]

    def unload(self) -> None:
        """Lepas model dari RAM Ollama (dipanggil setelah job selesai/gagal)."""
        try:
            self.http.post("/api/generate", json={"model": self.s.ollama_model, "keep_alive": self.s.ollama_keep_alive},
                           timeout=30)
        except httpx.HTTPError:
            pass

    def close(self) -> None:
        self.http.close()


def generate_minutes(
    s: Settings,
    segments: list[dict],
    meeting: dict,
    speaker_names: dict[str, str] | None,
    on_progress: Callable[[float, float | None], None],
    check_cancel: Callable[[], None],
) -> str:
    """Kembalikan notulen Markdown lengkap (header + isi dari LLM)."""
    header = minutes_header(meeting)
    lines = transcript_lines(segments, speaker_names)
    if not lines:
        return header + "\n\n## Ringkasan\nTidak ada ucapan yang terdeteksi pada rekaman.\n"

    client = OllamaClient(s)
    calls_done = 0
    call_seconds: list[float] = []
    chunks = chunk_lines(lines, s.summary_chunk_chars)
    planned = (len(chunks) if len(chunks) > 1 else 0) + 1  # map + final; reduce ditambah bila perlu

    def call(prompt: str) -> str:
        nonlocal calls_done
        check_cancel()
        t0 = time.monotonic()
        out = client.chat(prompt, keep_alive=s.ollama_keep_alive_in_job)
        call_seconds.append(time.monotonic() - t0)
        calls_done += 1
        avg = sum(call_seconds) / len(call_seconds)
        on_progress(calls_done / max(planned, calls_done + 1), avg * max(0, planned - calls_done))
        return out

    try:
        if len(chunks) == 1:
            body = call(prompts.final_prompt(meeting, chunks[0], is_raw_transcript=True))
        else:
            notes = [call(prompts.map_prompt(meeting, c, i + 1, len(chunks))) for i, c in enumerate(chunks)]
            # Reduce bertahap sampai gabungan catatan cukup pendek untuk satu panggilan.
            while sum(len(n) for n in notes) > s.summary_reduce_max_chars and len(notes) > 1:
                groups = chunk_lines(notes, s.summary_reduce_max_chars)
                if len(groups) >= len(notes):  # tiap catatan sudah sepanjang batas: gabung berpasangan
                    groups = ["\n\n".join(notes[i:i + 2]) for i in range(0, len(notes), 2)]
                planned += len(groups)
                notes = [call(prompts.reduce_prompt(meeting, g)) for g in groups]
            body = call(prompts.final_prompt(meeting, "\n\n".join(notes), is_raw_transcript=False))
    finally:
        client.unload()
        client.close()

    # Buang judul/pengantar yang mungkin ditambahkan model sebelum "## Ringkasan".
    idx = body.find("## ")
    if idx > 0:
        body = body[idx:]
    return f"{header}\n\n{body.strip()}\n"
