"""Proses worker: mengambil job dari antrean SATU per SATU dan menjalankan pipeline
membaca audio → transkripsi → (pemisahan pembicara) → notulen.

Berjalan sebagai proses terpisah berprioritas rendah. Jika proses ini mati (mis. dibunuh
OOM killer), proses API tetap hidup, menandai job gagal, lalu menyalakan worker baru.
"""
from __future__ import annotations

import gc
import logging
import multiprocessing as mp
import os
import time
import traceback
from pathlib import Path

import psutil

from . import jobs as J
from .audio import (SAMPLE_RATE, AudioPathError, decode_to_f32, iter_array_windows, iter_windows, open_f32,
                    probe_duration, resolve_audio_path)
from .config import Settings, get_settings
from .memory import NotEnoughMemory, require_ram
from .summarizer import LLMError, generate_minutes
from .textproc import assign_speakers
from .transcriber import Transcriber, build_initial_prompt, resolve_device

log = logging.getLogger("worker")

STAGE_LABELS = {
    "reading_audio": "Membaca audio",
    "transcribing": "Transkripsi",
    "diarizing": "Pemisahan pembicara",
    "summarizing": "Menyusun notulen",
}


class JobCancelled(Exception):
    pass


class ParentGone(Exception):
    """Proses API induk sudah berhenti; job akan diantrekan ulang saat service menyala lagi."""


def _parent_alive() -> bool:
    # Pakai sentinel multiprocessing: di Windows psutil.pid_exists() tetap True untuk induk
    # yang sudah mati selama handle-nya masih dipegang proses ini.
    parent = mp.parent_process()
    return parent is None or parent.is_alive()


class Progress:
    """Menghitung progress total dari bobot tiap tahap dan menulis ke DB (dibatasi ±1 kali/detik)."""

    def __init__(self, store: J.JobStore, job_id: str, weights: dict[str, float]):
        self.store, self.job_id = store, job_id
        total = sum(weights.values())
        self.offsets: dict[str, tuple[float, float]] = {}
        acc = 0.0
        for stage, w in weights.items():
            self.offsets[stage] = (acc / total, w / total)
            acc += w
        self._last_write = 0.0
        self._last_cancel_check = 0.0

    def update(self, stage: str, frac: float, eta: float | None = None, force: bool = False) -> None:
        now = time.monotonic()
        if not force and now - self._last_write < 1.0:
            return
        self._last_write = now
        frac = min(max(frac, 0.0), 1.0)
        start, width = self.offsets.get(stage, (0.0, 0.0))
        self.store.progress(self.job_id, stage=stage, progress=start + width * frac,
                            stage_progress=frac, eta_seconds=None if eta is None else round(eta, 1))

    def check_cancel(self) -> None:
        now = time.monotonic()
        if now - self._last_cancel_check < 3.0:
            return
        self._last_cancel_check = now
        if not _parent_alive():
            raise ParentGone()
        if self.store.is_cancel_requested(self.job_id):
            raise JobCancelled()


def _speed_eta(done: float, total: float, started: float) -> float | None:
    elapsed = time.monotonic() - started
    if done <= 0 or elapsed < 5:
        return None
    return max(0.0, (total - done) * elapsed / done)


class Pipeline:
    def __init__(self, s: Settings, store: J.JobStore):
        self.s, self.store = s, store
        self.transcriber = Transcriber(s)

    # ------------------------------------------------------------------ transcription
    def _require_whisper_ram(self) -> None:
        if self.transcriber.loaded_name != self.s.whisper_model:
            require_ram(self.s.whisper_required_ram_mb(), f"model Whisper '{self.s.whisper_model}'",
                        "Tunggu layanan lain selesai, atau pakai WHISPER_MODEL yang lebih kecil / "
                        "turunkan WHISPER_MIN_FREE_RAM_MB jika yakin.")

    def _transcribe_per_file(self, job: dict, files: list[Path], prog: Progress, prompt: str | None) -> dict:
        """Diarization mati: tiap file diproses bergantian, timestamp diberi offset."""
        ck = job.get("checkpoint") or {}
        done: list[dict] = ck.get("files", [])
        prog.update("reading_audio", 0, force=True)
        durations = []
        for i, f in enumerate(files):
            durations.append(probe_duration(f))
            prog.update("reading_audio", (i + 1) / len(files))
        total = sum(durations) or 1.0

        self._require_whisper_ram()
        prog.update("transcribing", 0, force=True)
        self.transcriber.load()
        offset = sum(d["duration"] for d in done)
        done_est = sum(durations[: len(done)])
        started = time.monotonic()
        processed_at_start = done_est
        for i, f in enumerate(files):
            if i < len(done):
                continue
            segs: list[dict] = []
            actual = 0.0
            for win in iter_windows(f, self.s.audio_window_seconds):
                base = offset + win.start
                for seg in self.transcriber.transcribe(win.samples, initial_prompt=prompt, word_timestamps=False):
                    seg["start"] = round(base + seg["start"], 2)
                    seg["end"] = round(base + seg["end"], 2)
                    seg["speaker"] = None
                    segs.append(seg)
                    pos = done_est + win.start + seg["end"] - base
                    prog.update("transcribing", pos / total,
                                _speed_eta(pos - processed_at_start, total - processed_at_start, started))
                    prog.check_cancel()
                actual = win.start + len(win.samples) / SAMPLE_RATE
                del win
            done.append({"index": i, "path": str(f), "offset": round(offset, 2),
                         "duration": round(actual, 2), "segments": segs})
            self.store.save_checkpoint(job["id"], {"files": done})
            offset += actual
            done_est += durations[i]
        segments = [seg for d in done for seg in d["segments"]]
        files_info = [{k: d[k] for k in ("path", "offset", "duration")} for d in done]
        return {"segments": segments, "files": files_info, "duration_seconds": round(offset, 2)}

    def _transcribe_diarized(self, job: dict, files: list[Path], prog: Progress, prompt: str | None) -> dict:
        """Diarization aktif: semua file didekode menjadi satu file float32 sementara di disk
        (dibaca lewat memmap), transkripsi per kata, lalu label pembicara diberikan per kata
        dan digabung menjadi ucapan."""
        opts = job["payload"].get("options") or {}
        raw = self.s.tmp_dir / f"{job['id']}.f32"
        samples = None
        try:
            prog.update("reading_audio", 0, force=True)
            durations = decode_to_f32(files, raw, lambda i: prog.update("reading_audio", (i + 1) / len(files)),
                                      prog.check_cancel)
            total = sum(durations) or 1.0
            files_info, acc = [], 0.0
            for f, d in zip(files, durations):
                files_info.append({"path": str(f), "offset": round(acc, 2), "duration": round(d, 2)})
                acc += d
            samples = open_f32(raw)

            self._require_whisper_ram()
            prog.update("transcribing", 0, force=True)
            self.transcriber.load()
            started = time.monotonic()
            words: list[dict] = []
            plain: list[dict] = []
            for win in iter_array_windows(samples, self.s.audio_window_seconds):
                for seg in self.transcriber.transcribe(win.samples, initial_prompt=prompt, word_timestamps=True):
                    for w in seg.pop("words", []):
                        words.append({"start": round(win.start + w["start"], 2),
                                      "end": round(win.start + w["end"], 2), "word": w["word"]})
                    plain.append({"start": round(win.start + seg["start"], 2),
                                  "end": round(win.start + seg["end"], 2), "speaker": None, "text": seg["text"]})
                    pos = win.start + seg["end"]
                    prog.update("transcribing", pos / total, _speed_eta(pos, total, started))
                    prog.check_cancel()
                del win
            if self.s.whisper_unload_after_job:
                self.transcriber.unload()

            prog.update("diarizing", 0, force=True)
            started = time.monotonic()
            try:
                need = self.s.diarization_min_free_ram_mb + int(self.s.diarization_ram_mb_per_hour * total / 3600)
                require_ram(need, f"pemisahan pembicara audio {total / 3600:.1f} jam",
                            "Transkrip disimpan tanpa label pembicara. Matikan pemisahan pembicara untuk "
                            "rapat sangat panjang, atau tambah RAM server.")

                def on_diar(f: float) -> None:
                    prog.update("diarizing", f, _speed_eta(f, 1.0, started))
                    prog.check_cancel()

                turns = diarize_fn(self.s, samples, on_diar, num_speakers=opts.get("num_speakers"))
                segments = assign_speakers(words, turns, self.s.speaker_merge_gap_seconds)
            except (NotEnoughMemory, RuntimeError, OSError) as e:
                log.warning("Diarization gagal: %s", e)
                self.store.add_warning(job["id"], f"Pemisahan pembicara gagal: {e}")
                segments = plain
            return {"segments": segments, "files": files_info, "duration_seconds": round(total, 2)}
        finally:
            # memmap harus ditutup dulu; di Windows file yang masih dipetakan tidak bisa dihapus.
            del samples
            gc.collect()
            raw.unlink(missing_ok=True)

    # ------------------------------------------------------------------ jobs
    def run_transcribe(self, job: dict) -> dict:
        p = job["payload"]
        opts = p.get("options") or {}
        meeting = p.get("meeting") or {}
        use_diar = self.s.enable_diarization and opts.get("diarization") is not False
        summarize = opts.get("summarize", True)
        weights = {"reading_audio": 0.03 if not use_diar else 0.05,
                   "transcribing": 0.67 if not use_diar else 0.45}
        if use_diar:
            weights["diarizing"] = 0.2
        if summarize:
            weights["summarizing"] = 0.3
        prog = Progress(self.store, job["id"], weights)
        timings: dict[str, float] = {}

        ck = job.get("checkpoint") or {}
        transcript = ck.get("transcript")
        if transcript is None:
            files = [resolve_audio_path(f, self.s.storage_dir, self.s.audio_extensions) for f in p["audio_files"]]
            prompt = build_initial_prompt(self.s.whisper_initial_prompt, meeting)
            t0 = time.monotonic()
            try:
                transcript = (self._transcribe_diarized if use_diar else self._transcribe_per_file)(
                    job, files, prog, prompt)
            finally:
                if self.s.whisper_unload_after_job:
                    self.transcriber.unload()
            timings["transcription_seconds"] = round(time.monotonic() - t0, 1)
            transcript.update(
                language=self.s.whisper_language,
                whisper_model=self.s.whisper_model,
                whisper_device=resolve_device(self.s.whisper_device),
                diarization=use_diar,
                speakers=sorted({sg["speaker"] for sg in transcript["segments"] if sg.get("speaker")}),
            )
            # Simpan transkrip lebih dulu: jika tahap LLM gagal/terputus, transkrip tidak hilang.
            self.store.save_checkpoint(job["id"], {"transcript": transcript, "timings": timings})
        else:
            timings = ck.get("timings", {})

        result = {"transcript": transcript, "minutes_markdown": None, "minutes_error": None,
                  "llm_model": None, "timings": timings}
        if summarize:
            result.update(self._summarize(job, transcript["segments"], meeting, p.get("speaker_names"), prog))
            timings.update(result.pop("_timings", {}))
        return result

    def run_summarize(self, job: dict) -> dict:
        p = job["payload"]
        prog = Progress(self.store, job["id"], {"summarizing": 1.0})
        out = self._summarize(job, p["segments"], p.get("meeting") or {}, p.get("speaker_names"), prog,
                              raise_errors=True)
        return {"minutes_markdown": out["minutes_markdown"], "llm_model": out["llm_model"],
                "timings": out.pop("_timings")}

    def _summarize(self, job: dict, segments: list[dict], meeting: dict, speaker_names: dict | None,
                   prog: Progress, raise_errors: bool = False) -> dict:
        prog.update("summarizing", 0, force=True)
        t0 = time.monotonic()
        try:
            require_ram(self.s.llm_min_free_ram_mb, f"LLM '{self.s.ollama_model}'",
                        "Transkrip tetap tersimpan; buat ulang notulen nanti atau pakai model Ollama yang lebih kecil.")
            md = generate_minutes(self.s, segments, meeting, speaker_names,
                                  lambda f, eta: prog.update("summarizing", f, eta), prog.check_cancel)
            return {"minutes_markdown": md, "minutes_error": None, "llm_model": self.s.ollama_model,
                    "_timings": {"summary_seconds": round(time.monotonic() - t0, 1)}}
        except JobCancelled:
            if raise_errors:
                raise
            # Dibatalkan saat menyusun notulen: transkrip yang sudah jadi tetap dikirim sebagai hasil.
            log.info("Pembuatan notulen job %s dibatalkan; transkrip tetap disimpan", job["id"])
            return {"minutes_markdown": None, "llm_model": self.s.ollama_model, "_timings": {},
                    "minutes_error": "Pembuatan notulen dibatalkan. Transkrip tetap tersimpan; "
                                     "klik \"Buat ulang notulen\" untuk mencoba lagi."}
        except (LLMError, NotEnoughMemory) as e:
            if raise_errors:
                raise
            log.warning("Tahap notulen gagal: %s", e)
            self.store.add_warning(job["id"], f"Notulen gagal dibuat: {e}")
            return {"minutes_markdown": None, "minutes_error": str(e), "llm_model": self.s.ollama_model,
                    "_timings": {}}

    def run(self, job: dict) -> None:
        # Model pilihan admin untuk rapat ini (sudah divalidasi saat job dibuat). Pengaturan
        # dasar dipulihkan setelah job selesai.
        opts = job["payload"].get("options") or {}
        pilihan = {k: v for k, v in (("whisper_model", opts.get("whisper_model")),
                                     ("ollama_model", opts.get("llm_model"))) if v}
        dasar = self.s
        if pilihan:
            self.s = self.transcriber.s = dasar.model_copy(update=pilihan)
        try:
            self._run(job)
        finally:
            self.s = self.transcriber.s = dasar

    def _run(self, job: dict) -> None:
        log.info("Mulai job %s (%s, percobaan ke-%d, Whisper=%s, LLM=%s)", job["id"], job["type"],
                 job["attempts"], self.s.whisper_model, self.s.ollama_model)
        try:
            if job["type"] == "summarize":
                result = self.run_summarize(job)
            else:
                result = self.run_transcribe(job)
            self.store.finish(job["id"], J.DONE, result=result)
            log.info("Job %s selesai", job["id"])
        except JobCancelled:
            self.store.finish(job["id"], J.CANCELLED, error="Dibatalkan oleh pengguna.")
            log.info("Job %s dibatalkan", job["id"])
        except ParentGone:
            log.info("Proses induk berhenti; job %s dibiarkan untuk diantrekan ulang", job["id"])
            raise
        except (AudioPathError, NotEnoughMemory, LLMError) as e:
            self.store.finish(job["id"], J.FAILED, error=str(e))
            log.warning("Job %s gagal: %s", job["id"], e)
        except Exception as e:  # noqa: BLE001
            log.error("Job %s gagal:\n%s", job["id"], traceback.format_exc())
            self.store.finish(job["id"], J.FAILED, error=f"Kesalahan tak terduga: {type(e).__name__}: {e}")
        finally:
            if self.s.whisper_unload_after_job:
                self.transcriber.unload()


def diarize_fn(*args, **kwargs):  # noqa: ANN002, ANN003
    from .diarizer import diarize  # impor malas: sherpa-onnx hanya dimuat bila dipakai

    return diarize(*args, **kwargs)


def lower_priority(nice: int) -> None:
    p = psutil.Process()
    try:
        if os.name == "nt":
            if nice > 0:
                p.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS if nice < 15 else psutil.IDLE_PRIORITY_CLASS)
        else:
            if p.nice() < nice:
                p.nice(nice)
            p.ionice(psutil.IOPRIO_CLASS_BE, 7)
    except (psutil.Error, OSError, ValueError) as e:
        log.warning("Gagal menurunkan prioritas worker: %s", e)


def worker_main() -> None:
    s = get_settings()
    # Batasi thread pustaka numerik (OpenMP/MKL) sesuai jatah CPU.
    for var in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
        os.environ[var] = str(s.whisper_cpu_threads)
    logging.basicConfig(level=s.log_level.upper(), format="%(asctime)s [worker] %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    lower_priority(s.worker_nice)
    store = J.JobStore(s.jobs_db_path)
    pipeline = Pipeline(s, store)
    log.info("Worker siap (pid=%d)", os.getpid())
    while True:
        if not _parent_alive():
            log.info("Proses induk berhenti; worker keluar")
            return
        job = store.claim_next(os.getpid())
        if job is None:
            time.sleep(s.worker_poll_seconds)
            continue
        try:
            pipeline.run(job)
        except ParentGone:
            return
