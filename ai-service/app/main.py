"""Service AI notulensi: FastAPI, listen hanya di 127.0.0.1.

Proses API ringan; pekerjaan berat dijalankan oleh satu proses worker (lihat worker.py)
yang diawasi oleh thread supervisor di sini.
"""
from __future__ import annotations

import hmac
import logging
import multiprocessing as mp
import threading
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import __version__
from . import jobs as J
from .audio import AudioPathError, resolve_audio_path
from .config import Settings, get_settings
from .diarizer import diarization_installed, model_paths
from .memory import ram_info
from .schemas import JobCreate, JobOut
from .transcriber import is_downloaded
from .worker import STAGE_LABELS, worker_main

log = logging.getLogger("ai-service")


class WorkerSupervisor:
    """Menjalankan satu proses worker dan menyalakannya ulang bila mati."""

    def __init__(self, s: Settings, store: J.JobStore):
        self.s, self.store = s, store
        self.ctx = mp.get_context("spawn")
        self.proc: mp.Process | None = None
        self.last_exit: str | None = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="worker-supervisor", daemon=True)

    def start(self) -> None:
        self._spawn()
        self._thread.start()

    def _spawn(self) -> None:
        self.proc = self.ctx.Process(target=worker_main, name="notulensi-worker", daemon=True)
        self.proc.start()
        log.info("Worker dijalankan (pid=%s)", self.proc.pid)

    def _loop(self) -> None:
        while not self._stop.wait(2.0):
            p = self.proc
            if p is not None and not p.is_alive():
                code = p.exitcode
                hint = " (kemungkinan kehabisan RAM / dihentikan OOM killer)" if code in (-9, 137) else ""
                reason = f"Proses worker berhenti tiba-tiba (exit code {code}){hint}."
                self.last_exit = reason
                log.error(reason)
                self.store.fail_jobs_of_dead_worker(p.pid, reason)  # type: ignore[arg-type]
                time.sleep(3)
                if not self._stop.is_set():
                    self._spawn()

    def alive(self) -> bool:
        return bool(self.proc and self.proc.is_alive())

    def stop(self) -> None:
        self._stop.set()
        if self.proc and self.proc.is_alive():
            # Job yang sedang berjalan akan diantrekan ulang saat service menyala lagi.
            self.proc.terminate()
            self.proc.join(10)
            if self.proc.is_alive():
                self.proc.kill()


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    logging.basicConfig(level=s.log_level.upper(), format="%(asctime)s [api] %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    s.storage_dir.mkdir(parents=True, exist_ok=True)
    store = J.JobStore(s.jobs_db_path)
    n = store.requeue_interrupted(s.job_max_attempts)
    if n:
        log.warning("%d job yang terputus diantrekan ulang", n)
    sup = WorkerSupervisor(s, store)
    sup.start()
    app.state.store, app.state.supervisor = store, sup
    log.info("Service AI siap di http://%s:%d (model Whisper=%s, device=%s, diarization=%s, LLM=%s)",
             s.host, s.port, s.whisper_model, s.whisper_device, s.enable_diarization, s.ollama_model)
    yield
    sup.stop()


app = FastAPI(title="Service AI Notulensi", version=__version__, lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def _validation_error(_req: Request, exc: RequestValidationError):
    msgs = [f"{'.'.join(str(x) for x in e['loc'][1:]) or 'body'}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": "Data tidak valid. " + "; ".join(msgs)})


def require_token(request: Request) -> None:
    token = get_settings().api_token
    if token and not hmac.compare_digest(request.headers.get("x-api-key", ""), token):
        raise HTTPException(401, "Token API tidak valid (header X-API-Key).")


def _job_out(store: J.JobStore, job: dict, include_result: bool) -> JobOut:
    return JobOut(
        **{k: job[k] for k in ("id", "type", "status", "stage", "progress", "stage_progress", "eta_seconds",
                               "attempts", "error", "warnings", "created_at", "started_at", "finished_at")},
        stage_label=STAGE_LABELS.get(job["stage"] or ""),
        queue_position=store.queue_position(job),
        result=job["result"] if include_result else None,
    )


def _diarization_models_ready(s: Settings) -> bool:
    try:
        model_paths(s, download=False)
        return True
    except RuntimeError:
        return False


async def _ollama_models(s: Settings) -> list[dict] | None:
    """Model yang terpasang di Ollama, atau None bila Ollama tidak dapat dihubungi."""
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{s.ollama_url}/api/tags")
            return r.json().get("models", [])
    except (httpx.HTTPError, ValueError):
        return None


def _ollama_name_ok(name: str, installed: set[str]) -> bool:
    return name in installed or f"{name}:latest" in installed


@app.get("/models", dependencies=[Depends(require_token)])
async def list_models():
    """Pilihan model untuk layar Proses: Whisper (transkripsi) dan Ollama (notulen)."""
    s = get_settings()
    whisper = [{
        "name": m,
        "default": m == s.whisper_model,
        "required_ram_mb": s.whisper_required_ram_mb(m),
        "downloaded": is_downloaded(m, s.whisper_download_root),
    } for m in s.whisper_choices()]
    tags = await _ollama_models(s)
    allowed = s.ollama_choices()
    llm = []
    if tags is not None:
        for t in tags:
            name = t.get("name", "")
            if allowed is None or _ollama_name_ok(name, set(allowed)) or name.removesuffix(":latest") in allowed:
                llm.append({"name": name, "default": name in (s.ollama_model, f"{s.ollama_model}:latest"),
                            "size_mb": int(t.get("size", 0)) // (1024 * 1024)})
    return {"whisper": whisper, "llm": llm, "ollama_reachable": tags is not None,
            "default_whisper": s.whisper_model, "default_llm": s.ollama_model}


@app.get("/health")
async def health():
    s = get_settings()
    store: J.JobStore = app.state.store
    ollama: dict = {"url": s.ollama_url, "model": s.ollama_model, "reachable": False, "model_available": False}
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            r = await c.get(f"{s.ollama_url}/api/tags")
            names = {m.get("name") for m in r.json().get("models", [])}
            ollama["reachable"] = True
            ollama["model_available"] = s.ollama_model in names or f"{s.ollama_model}:latest" in names
    except (httpx.HTTPError, ValueError):
        pass
    ram = ram_info()
    need = s.whisper_required_ram_mb()
    return {
        "status": "ok" if app.state.supervisor.alive() else "degraded",
        "version": __version__,
        "worker_alive": app.state.supervisor.alive(),
        "worker_last_exit": app.state.supervisor.last_exit,
        "queue": store.counts(),
        "ram": {**ram,
                "required_whisper_mb": need,
                "required_llm_mb": s.llm_min_free_ram_mb,
                "required_diarization_mb_per_hour_audio": s.diarization_ram_mb_per_hour if s.enable_diarization else None,
                "enough_for_whisper": ram["available_mb"] >= need},
        "whisper": {"model": s.whisper_model, "device": s.whisper_device, "compute_type": s.whisper_compute_type,
                    "cpu_threads": s.whisper_cpu_threads, "language": s.whisper_language},
        "diarization": {"enabled": s.enable_diarization, "engine": "sherpa-onnx",
                        "installed": diarization_installed(), "models_ready": _diarization_models_ready(s)},
        "ollama": ollama,
        "storage_dir": str(s.storage_dir),
    }


@app.post("/jobs", response_model=JobOut, status_code=201, dependencies=[Depends(require_token)])
async def create_job(body: JobCreate):
    s = get_settings()
    store: J.JobStore = app.state.store
    payload = body.model_dump()
    wm, lm = body.options.whisper_model, body.options.llm_model
    if wm and wm not in s.whisper_choices():
        raise HTTPException(400, f"Model transkripsi '{wm}' tidak diizinkan di server ini. "
                                 f"Pilihan: {', '.join(s.whisper_choices())} (atur WHISPER_ALLOWED_MODELS).")
    if lm:
        allowed = s.ollama_choices()
        if allowed is not None and lm.removesuffix(":latest") not in [a.removesuffix(":latest") for a in allowed]:
            raise HTTPException(400, f"Model notulen '{lm}' tidak diizinkan di server ini (atur OLLAMA_ALLOWED_MODELS).")
        tags = await _ollama_models(s)
        if tags is not None and not _ollama_name_ok(lm, {t.get("name", "") for t in tags}):
            raise HTTPException(400, f"Model notulen '{lm}' belum terpasang di Ollama. Jalankan: ollama pull {lm}")
    if body.type == "transcribe":
        try:
            payload["audio_files"] = [str(resolve_audio_path(f, s.storage_dir, s.audio_extensions))
                                      for f in body.audio_files]
        except AudioPathError as e:
            raise HTTPException(400, str(e)) from None
        if body.options.diarization and not s.enable_diarization:
            raise HTTPException(400, "Pemisahan pembicara tidak aktif di server (ENABLE_DIARIZATION=false).")
        counts = store.counts()
        avail = ram_info()["available_mb"]
        need = s.whisper_required_ram_mb(wm)
        # Tolak langsung bila antrean kosong tetapi RAM saat ini jelas tidak cukup.
        if counts[J.QUEUED] == 0 and counts[J.RUNNING] == 0 and avail < need:
            raise HTTPException(
                503,
                f"RAM tersedia hanya {avail} MB, sedangkan model Whisper '{wm or s.whisper_model}' membutuhkan "
                f"minimal {need} MB. Coba lagi nanti saat server lebih longgar, atau pakai model yang lebih kecil.",
            )
    job = store.create(body.type, payload)
    log.info("Job %s dibuat (%s, %d file)", job["id"], body.type, len(body.audio_files))
    return _job_out(store, job, include_result=False)


@app.get("/jobs/{job_id}", response_model=JobOut, dependencies=[Depends(require_token)])
async def get_job(job_id: str, include_result: bool = Query(True, description="false = status saja (untuk polling)")):
    store: J.JobStore = app.state.store
    job = store.get(job_id)
    if job is None:
        raise HTTPException(404, "Job tidak ditemukan.")
    return _job_out(store, job, include_result)


@app.post("/jobs/{job_id}/cancel", response_model=JobOut, dependencies=[Depends(require_token)])
async def cancel_job(job_id: str):
    store: J.JobStore = app.state.store
    job = store.request_cancel(job_id)
    if job is None:
        raise HTTPException(404, "Job tidak ditemukan.")
    return _job_out(store, job, include_result=False)


@app.delete("/jobs/{job_id}", status_code=204, dependencies=[Depends(require_token)])
async def delete_job(job_id: str):
    store: J.JobStore = app.state.store
    if store.get(job_id) is None:
        raise HTTPException(404, "Job tidak ditemukan.")
    if not store.delete(job_id):
        raise HTTPException(409, "Job masih berjalan/antre. Batalkan dulu sebelum dihapus.")
