"""Utilitas audio: validasi path, durasi, dan dekode bertahap (streaming) ke 16 kHz mono.

Audio TIDAK pernah dimuat utuh ke RAM. Rapat 6 jam = ±1,4 GB float32 jika dimuat sekaligus,
jadi audio didekode per jendela (default 10 menit) dan dipotong di titik paling hening.
"""
from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

import av
import numpy as np

SAMPLE_RATE = 16000


class AudioPathError(ValueError):
    pass


def resolve_audio_path(raw: str, storage_dir: Path, allowed_ext: set[str]) -> Path:
    """Pastikan file ada di DALAM storage_dir (cegah path traversal & symlink keluar)."""
    if not raw or "\x00" in raw:
        raise AudioPathError("Path file audio kosong atau tidak valid.")
    p = Path(raw)
    if not p.is_absolute():
        raise AudioPathError(f"Path file audio harus absolut: {raw}")
    try:
        real = p.resolve(strict=True)
    except (FileNotFoundError, OSError):
        raise AudioPathError(f"File audio tidak ditemukan: {raw}") from None
    root = storage_dir.resolve()
    real_n = os.path.normcase(str(real))
    root_n = os.path.normcase(str(root))
    if os.path.commonpath([real_n, root_n]) != root_n:
        raise AudioPathError(f"File di luar folder storage tidak diizinkan: {raw}")
    if not real.is_file():
        raise AudioPathError(f"Bukan file: {raw}")
    if real.suffix.lower() not in allowed_ext:
        raise AudioPathError(
            f"Ekstensi '{real.suffix}' tidak didukung. Yang diizinkan: {', '.join(sorted(allowed_ext))}"
        )
    if real.stat().st_size == 0:
        raise AudioPathError(f"File audio kosong (0 byte): {raw}")
    return real


def probe_duration(path: Path) -> float:
    """Durasi dalam detik. File webm hasil MediaRecorder sering tanpa metadata durasi,
    jadi bila perlu paket di-demux (tanpa dekode) untuk mencari timestamp terakhir."""
    with av.open(str(path)) as c:
        if not c.streams.audio:
            raise AudioPathError(f"File tidak berisi trek audio: {path.name}")
        stream = c.streams.audio[0]
        if c.duration and c.duration > 0:
            return c.duration / 1_000_000
        if stream.duration and stream.time_base:
            return float(stream.duration * stream.time_base)
        end = 0.0
        for packet in c.demux(stream):
            if packet.pts is None or packet.time_base is None:
                continue
            t = float((packet.pts + (packet.duration or 0)) * packet.time_base)
            end = max(end, t)
        return end


def _iter_frames_16k(path: Path) -> Iterator[np.ndarray]:
    resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
    with av.open(str(path)) as c:
        stream = c.streams.audio[0]
        stream.thread_type = "AUTO"
        for frame in c.decode(stream):
            frame.pts = None
            for out in resampler.resample(frame):
                yield out.to_ndarray().reshape(-1)
        for out in resampler.resample(None):
            yield out.to_ndarray().reshape(-1)


def _quietest_split(buf: np.ndarray, search_seconds: float = 10.0, frame_ms: int = 100) -> int:
    """Indeks sampel di bagian akhir buffer dengan energi terendah (batas potong yang aman)."""
    frame = SAMPLE_RATE * frame_ms // 1000
    n_search = min(len(buf), int(search_seconds * SAMPLE_RATE))
    tail = buf[len(buf) - n_search :]
    n_frames = len(tail) // frame
    if n_frames < 2:
        return len(buf)
    energy = np.square(tail[: n_frames * frame].reshape(n_frames, frame)).mean(axis=1)
    idx = int(np.argmin(energy))
    return len(buf) - n_search + idx * frame + frame // 2


@dataclass
class AudioWindow:
    start: float  # detik, relatif terhadap awal file
    samples: np.ndarray  # float32 mono 16 kHz


def iter_windows(path: Path, window_seconds: float) -> Iterator[AudioWindow]:
    """Dekode file dan hasilkan jendela audio float32 ± window_seconds, dipotong di titik hening."""
    target = int(window_seconds * SAMPLE_RATE)
    parts: list[np.ndarray] = []
    size = 0
    consumed = 0  # sampel yang sudah dikeluarkan
    for chunk in _iter_frames_16k(path):
        parts.append(chunk)
        size += len(chunk)
        if size >= target + 15 * SAMPLE_RATE:
            buf = np.concatenate(parts)
            cut = _quietest_split(buf[:target + 5 * SAMPLE_RATE])
            yield AudioWindow(consumed / SAMPLE_RATE, buf[:cut].astype(np.float32) / 32768.0)
            consumed += cut
            rest = buf[cut:]
            parts, size = [rest], len(rest)
    if size:
        buf = np.concatenate(parts)
        yield AudioWindow(consumed / SAMPLE_RATE, buf.astype(np.float32) / 32768.0)


def decode_to_f32(paths: list[Path], out: Path, on_file_done: Callable[[int], None] | None = None) -> list[float]:
    """Gabungkan beberapa file menjadi satu file mentah float32 16 kHz mono di disk (streaming).
    File ini dibuka dengan np.memmap: halamannya milik page cache (bisa dibuang OS saat RAM
    sempit), bukan memori proses. Mengembalikan durasi tiap file (detik)."""
    durations: list[float] = []
    with open(out, "wb") as f:
        for i, p in enumerate(paths):
            n = 0
            for chunk in _iter_frames_16k(p):
                f.write((chunk.astype(np.float32) / 32768.0).astype("<f4").tobytes())
                n += len(chunk)
            durations.append(n / SAMPLE_RATE)
            if on_file_done:
                on_file_done(i)
    return durations


def open_f32(path: Path) -> np.ndarray:
    if path.stat().st_size == 0:
        return np.zeros(0, dtype=np.float32)
    return np.memmap(path, dtype="<f4", mode="r")


def iter_array_windows(samples: np.ndarray, window_seconds: float) -> Iterator[AudioWindow]:
    """Seperti iter_windows, tetapi dari array/memmap yang sudah didekode."""
    target = int(window_seconds * SAMPLE_RATE)
    pos, total = 0, len(samples)
    while pos < total:
        if total - pos >= target + 15 * SAMPLE_RATE:
            cut = _quietest_split(np.asarray(samples[pos:pos + target + 5 * SAMPLE_RATE]))
        else:
            cut = total - pos
        yield AudioWindow(pos / SAMPLE_RATE, np.array(samples[pos:pos + cut], dtype=np.float32))
        pos += cut
