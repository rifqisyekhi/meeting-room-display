"""Penyimpanan job di SQLite agar antrean & status tidak hilang saat service restart.

Dipakai bersama oleh proses API dan proses worker (mode WAL, transaksi pendek).
"""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

QUEUED, RUNNING, DONE, FAILED, CANCELLED = "queued", "running", "done", "failed", "cancelled"
FINAL_STATUSES = {DONE, FAILED, CANCELLED}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    stage TEXT,
    progress REAL NOT NULL DEFAULT 0,
    stage_progress REAL NOT NULL DEFAULT 0,
    eta_seconds REAL,
    payload TEXT NOT NULL,
    result TEXT,
    checkpoint TEXT,
    error TEXT,
    warnings TEXT NOT NULL DEFAULT '[]',
    attempts INTEGER NOT NULL DEFAULT 0,
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    worker_pid INTEGER,
    created_at REAL NOT NULL,
    started_at REAL,
    finished_at REAL,
    updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
"""

_JSON_COLS = ("payload", "result", "checkpoint", "warnings")


class JobStore:
    def __init__(self, path: Path):
        self.path = path
        with self._conn() as c:
            c.executescript(_SCHEMA)

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.path, timeout=30, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        try:
            yield conn
        finally:
            conn.close()

    @staticmethod
    def _row(row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        d = dict(row)
        for k in _JSON_COLS:
            if d.get(k) is not None:
                d[k] = json.loads(d[k])
        d["cancel_requested"] = bool(d["cancel_requested"])
        return d

    def _update(self, job_id: str, **fields: Any) -> None:
        fields["updated_at"] = time.time()
        for k in _JSON_COLS:
            if k in fields and fields[k] is not None:
                fields[k] = json.dumps(fields[k], ensure_ascii=False)
        cols = ", ".join(f"{k} = ?" for k in fields)
        with self._conn() as c:
            c.execute(f"UPDATE jobs SET {cols} WHERE id = ?", (*fields.values(), job_id))

    # ---- API ----
    def create(self, job_type: str, payload: dict) -> dict:
        now = time.time()
        job_id = uuid.uuid4().hex
        with self._conn() as c:
            c.execute(
                "INSERT INTO jobs (id, type, status, payload, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                (job_id, job_type, QUEUED, json.dumps(payload, ensure_ascii=False), now, now),
            )
        return self.get(job_id)  # type: ignore[return-value]

    def get(self, job_id: str) -> dict | None:
        with self._conn() as c:
            return self._row(c.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone())

    def queue_position(self, job: dict) -> int | None:
        """1 = job berikutnya yang akan diproses."""
        if job["status"] != QUEUED:
            return None
        with self._conn() as c:
            n = c.execute(
                "SELECT COUNT(*) FROM jobs WHERE status = ? AND created_at < ?",
                (QUEUED, job["created_at"]),
            ).fetchone()[0]
        return n + 1

    def counts(self) -> dict[str, int]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT status, COUNT(*) FROM jobs WHERE status IN (?, ?) GROUP BY status",
                (QUEUED, RUNNING),
            ).fetchall()
        d = {QUEUED: 0, RUNNING: 0}
        d.update({r[0]: r[1] for r in rows})
        return d

    def request_cancel(self, job_id: str) -> dict | None:
        job = self.get(job_id)
        if job is None or job["status"] in FINAL_STATUSES:
            return job
        if job["status"] == QUEUED:
            self._update(job_id, status=CANCELLED, finished_at=time.time(), error="Dibatalkan.")
        else:
            self._update(job_id, cancel_requested=1)
        return self.get(job_id)

    def delete(self, job_id: str) -> bool:
        with self._conn() as c:
            cur = c.execute("DELETE FROM jobs WHERE id = ? AND status IN (?, ?, ?)", (job_id, *FINAL_STATUSES))
            return cur.rowcount > 0

    def requeue_interrupted(self, max_attempts: int) -> int:
        """Saat service mulai: job yang terputus (status running) diantrekan ulang."""
        now = time.time()
        with self._conn() as c:
            c.execute(
                "UPDATE jobs SET status = ?, finished_at = ?, updated_at = ?, error = ? "
                "WHERE status = ? AND attempts >= ?",
                (FAILED, now, now,
                 f"Job terputus {max_attempts} kali dan tidak diulang lagi.", RUNNING, max_attempts),
            )
            cur = c.execute(
                "UPDATE jobs SET status = ?, stage = NULL, eta_seconds = NULL, worker_pid = NULL, "
                "updated_at = ? WHERE status = ?",
                (QUEUED, now, RUNNING),
            )
            return cur.rowcount

    def fail_jobs_of_dead_worker(self, pid: int, reason: str) -> None:
        now = time.time()
        with self._conn() as c:
            c.execute(
                "UPDATE jobs SET status = ?, error = ?, finished_at = ?, updated_at = ? "
                "WHERE status = ? AND worker_pid = ?",
                (FAILED, reason, now, now, RUNNING, pid),
            )

    # ---- Worker ----
    def claim_next(self, pid: int) -> dict | None:
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            row = c.execute(
                "SELECT id FROM jobs WHERE status = ? ORDER BY created_at LIMIT 1", (QUEUED,)
            ).fetchone()
            if row is None:
                c.execute("COMMIT")
                return None
            now = time.time()
            c.execute(
                "UPDATE jobs SET status = ?, worker_pid = ?, attempts = attempts + 1, "
                "started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?",
                (RUNNING, pid, now, now, row[0]),
            )
            c.execute("COMMIT")
        return self.get(row[0])

    def progress(self, job_id: str, *, stage: str, progress: float, stage_progress: float,
                 eta_seconds: float | None) -> None:
        self._update(job_id, stage=stage, progress=round(progress, 4),
                     stage_progress=round(stage_progress, 4), eta_seconds=eta_seconds)

    def is_cancel_requested(self, job_id: str) -> bool:
        with self._conn() as c:
            row = c.execute("SELECT cancel_requested FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return bool(row and row[0])

    def save_checkpoint(self, job_id: str, checkpoint: dict) -> None:
        self._update(job_id, checkpoint=checkpoint)

    def add_warning(self, job_id: str, message: str) -> None:
        job = self.get(job_id)
        if job is not None:
            self._update(job_id, warnings=[*job["warnings"], message])

    def finish(self, job_id: str, status: str, *, result: dict | None = None, error: str | None = None) -> None:
        fields: dict[str, Any] = dict(status=status, finished_at=time.time(), eta_seconds=None, error=error)
        if result is not None:
            fields["result"] = result
        if status == DONE:
            fields.update(progress=1.0, stage_progress=1.0)
        self._update(job_id, **fields)
