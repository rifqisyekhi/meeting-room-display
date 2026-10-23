"""Penyusunan notulen dengan peringkasan bertingkat (map-reduce) memakai Ollama lokal."""
from __future__ import annotations

import http.client
import json
import logging
import socket
import threading
import time
from collections.abc import Callable
from datetime import datetime
from urllib.parse import urlsplit

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

    def chat(self, user: str, keep_alive: str, check_cancel: Callable[[], None] | None = None) -> str:
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
        for attempt in range(3):
            try:
                status, raw = self._post_chat(body, check_cancel)
            except TimeoutError as e:
                raise LLMError(
                    f"Ollama tidak merespons dalam {self.s.ollama_timeout_seconds:.0f} detik "
                    "(OLLAMA_TIMEOUT_SECONDS). Coba model yang lebih kecil atau naikkan batas waktu."
                ) from e
            except (OSError, http.client.HTTPException) as e:
                raise LLMError(
                    f"Ollama tidak dapat dihubungi di {self.s.ollama_url}. Pastikan layanan Ollama berjalan."
                ) from e
            text = raw.decode("utf-8", errors="replace")
            if status == 404:
                raise LLMError(
                    f"Model '{self.s.ollama_model}' belum tersedia di Ollama. Jalankan: ollama pull {self.s.ollama_model}"
                )
            if status >= 400:
                try:
                    detail = json.loads(text).get("error", text)
                except ValueError:
                    detail = text
                if "memory" in detail.lower():
                    raise LLMError(f"Ollama kehabisan memori: {detail}. Gunakan model yang lebih kecil "
                                   "atau kurangi OLLAMA_NUM_CTX.")
                last_err = LLMError(f"Ollama mengembalikan error {r.status_code}: {detail}")
                # Model tanpa mode berpikir (mis. Gemma) bisa menolak parameter "think":
                # ulangi tanpa parameter itu, tag <think> tetap dibuang dari output.
                if "think" in body and "think" in detail.lower():
                    body.pop("think")
                    continue
                time.sleep(3)
                continue
            try:
                content = clean_llm_output(json.loads(text).get("message", {}).get("content", ""))
            except ValueError as e:
                raise LLMError(f"Jawaban Ollama tidak bisa dibaca: {text[:200]}") from e
            if content:
                return content
            last_err = LLMError("Ollama mengembalikan jawaban kosong.")
        raise last_err  # type: ignore[misc]

    def _post_chat(self, body: dict, check_cancel: Callable[[], None] | None) -> tuple[int, bytes]:
        """POST /api/chat di thread terpisah agar pembatalan job tidak menunggu Ollama selesai
        menjawab (satu potongan bisa belasan menit di CPU). Saat dibatalkan, socket diputus
        paksa (shutdown juga membangunkan recv yang sedang menunggu di Linux) dan Ollama
        menghentikan generasi karena klien terputus."""
        u = urlsplit(self.s.ollama_url)
        https = u.scheme == "https"
        conn_cls = http.client.HTTPSConnection if https else http.client.HTTPConnection
        conn = conn_cls(u.hostname or "127.0.0.1", u.port or (443 if https else 80),
                        timeout=self.s.ollama_timeout_seconds)
        hasil: dict = {}

        def kirim() -> None:
            try:
                conn.request("POST", u.path.rstrip("/") + "/api/chat", body=json.dumps(body).encode("utf-8"),
                             headers={"Content-Type": "application/json"})
                r = conn.getresponse()
                hasil["ok"] = (r.status, r.read())
            except BaseException as e:  # diteruskan ke thread pemanggil
                hasil["err"] = e

        t = threading.Thread(target=kirim, name="ollama-chat", daemon=True)
        t.start()
        try:
            while t.is_alive():
                t.join(1.0)
                if t.is_alive() and check_cancel is not None:
                    check_cancel()
        except BaseException:
            if conn.sock is not None:
                try:
                    conn.sock.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
            conn.close()
            raise
        conn.close()
        if "err" in hasil:
            raise hasil["err"]
        return hasil["ok"]

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
        out = client.chat(prompt, keep_alive=s.ollama_keep_alive_in_job, check_cancel=check_cancel)
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
