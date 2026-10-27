"""Pemisahan pembicara (opsional) dengan sherpa-onnx: segmentasi pyannote-3.0 + embedding
3D-Speaker dalam format ONNX. Tanpa torch dan tanpa token Hugging Face, jauh lebih hemat RAM
dibanding pyannote.audio. Diadaptasi dari OnTheRecord (engines/diarization.py).

Model (±40 MB) diunduh sekali ke WHISPER_DOWNLOAD_ROOT/diarization lewat
scripts/download_models.py --diarization (atau otomatis saat pertama dipakai bila online).
"""
from __future__ import annotations

import importlib.util
import logging
import shutil
import ssl
import tarfile
import urllib.request
from collections.abc import Callable
from pathlib import Path

import numpy as np

from .config import Settings
from .memory import release_memory

log = logging.getLogger(__name__)


def diarization_installed() -> bool:
    try:
        return importlib.util.find_spec("sherpa_onnx") is not None
    except ModuleNotFoundError:
        return False


def _ssl_context() -> ssl.SSLContext:
    """Sertifikat sistem + bundel certifi. Di Windows, Python hanya membaca root CA yang sudah
    ada di penyimpanan lokal (Windows melengkapinya belakangan), sehingga unduhan dari GitHub
    bisa gagal "unable to get issuer certificate". Sertifikat sistem tetap dipakai agar proxy
    HTTPS kantor (CA internal) juga dipercaya."""
    ctx = ssl.create_default_context()
    try:
        import certifi  # ikut terpasang bersama httpx

        ctx.load_verify_locations(certifi.where())
    except (ImportError, OSError):
        pass
    return ctx


def _download(url: str, dest: Path) -> None:
    log.info("Mengunduh %s", url)
    tmp = dest.with_suffix(dest.suffix + ".part")
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=_ssl_context()))
    with opener.open(url, timeout=120) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f)
    tmp.replace(dest)


def model_paths(s: Settings, download: bool = True) -> tuple[Path, Path]:
    root = s.whisper_download_root / "diarization"
    root.mkdir(parents=True, exist_ok=True)
    seg_dir = root / Path(s.diarization_segmentation_url).name.removesuffix(".tar.bz2")
    seg = seg_dir / "model.onnx"
    emb = root / Path(s.diarization_embedding_url).name
    missing = [p for p in (seg, emb) if not p.exists()]
    if missing and (not download or s.hf_hub_offline):
        raise RuntimeError(
            "Model diarization belum diunduh. Jalankan saat online: python scripts/download_models.py --diarization"
        )
    if not seg.exists():
        archive = root / "segmentation.tar.bz2"
        _download(s.diarization_segmentation_url, archive)
        with tarfile.open(archive) as tar:
            if hasattr(tarfile, "data_filter"):
                tar.extractall(root, filter="data")
            else:  # Python 3.11 lama tanpa filter
                tar.extractall(root)
        archive.unlink()
    if not emb.exists():
        _download(s.diarization_embedding_url, emb)
    return seg, emb


def diarize(s: Settings, samples: np.ndarray, on_progress: Callable[[float], None],
            num_speakers: int | None = None) -> list[tuple[float, float, str]]:
    """samples: float32 mono 16 kHz (boleh np.memmap). Mengembalikan (mulai, selesai, label)."""
    if not diarization_installed():
        raise RuntimeError("sherpa-onnx belum terpasang. Jalankan: pip install -r requirements.txt")
    import sherpa_onnx as so

    seg, emb = model_paths(s)
    threads = s.whisper_cpu_threads
    cfg = so.OfflineSpeakerDiarizationConfig(
        segmentation=so.OfflineSpeakerSegmentationModelConfig(
            pyannote=so.OfflineSpeakerSegmentationPyannoteModelConfig(model=str(seg)), num_threads=threads),
        embedding=so.SpeakerEmbeddingExtractorConfig(model=str(emb), num_threads=threads),
        clustering=so.FastClusteringConfig(num_clusters=num_speakers or -1,
                                           threshold=s.diarization_threshold),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not cfg.validate():
        raise RuntimeError("Konfigurasi model diarization tidak valid (file model rusak?).")
    sd = so.OfflineSpeakerDiarization(cfg)

    failure: list[BaseException] = []

    def cb(done: int, total: int) -> int:
        # Exception (mis. job dibatalkan) tidak boleh melewati batas C++: hentikan lewat nilai balik.
        try:
            if total:
                on_progress(done / total)
            return 0
        except BaseException as e:  # noqa: BLE001
            failure.append(e)
            return 1

    try:
        try:
            result = sd.process(samples, callback=cb).sort_by_start_time()
        except BaseException:
            # sherpa bisa melempar error sendiri setelah dihentikan callback: utamakan alasan aslinya.
            if failure:
                raise failure[0] from None
            raise
        if failure:
            raise failure[0]
        turns = [(float(r.start), float(r.end), str(r.speaker)) for r in result]
    finally:
        del sd
        release_memory()
    if not num_speakers:
        turns = merge_minor_speakers(turns, s.diarization_min_speaker_share, s.diarization_min_speaker_seconds)
    turns = renumber(turns)
    log.info("Diarization selesai: %d giliran bicara, %d pembicara", len(turns), len({t[2] for t in turns}))
    return turns


def merge_minor_speakers(turns: list[tuple[float, float, str]], min_share: float,
                         min_seconds: float) -> list[tuple[float, float, str]]:
    """Rapat nyata (derau, tawa, bicara bersamaan) menghasilkan banyak klaster kecil palsu.
    Pembicara dengan porsi bicara sangat kecil digabung ke pembicara utama terdekat."""
    total = sum(e - s for s, e, _ in turns) or 1.0
    talk: dict[str, float] = {}
    for s, e, spk in turns:
        talk[spk] = talk.get(spk, 0.0) + e - s
    major = {spk for spk, d in talk.items() if d >= max(min_seconds, min_share * total)}
    if not major and talk:
        major = {max(talk, key=talk.get)}
    out = []
    for i, (s, e, spk) in enumerate(turns):
        if spk in major:
            out.append((s, e, spk))
            continue
        best, gap = None, float("inf")
        for j in range(i - 1, -1, -1):
            if turns[j][2] in major:
                best, gap = turns[j][2], s - turns[j][1]
                break
        for j in range(i + 1, len(turns)):
            if turns[j][2] in major:
                if turns[j][0] - e < gap:
                    best = turns[j][2]
                break
        out.append((s, e, best or spk))
    return out


def renumber(turns: list[tuple[float, float, str]]) -> list[tuple[float, float, str]]:
    """SPEAKER_1, SPEAKER_2, ... sesuai urutan kemunculan pertama."""
    order: dict[str, str] = {}
    return [(s, e, order.setdefault(spk, f"SPEAKER_{len(order) + 1}")) for s, e, spk in turns]
