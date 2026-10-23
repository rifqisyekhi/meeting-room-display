"""Pemeriksaan RAM yang tersedia, termasuk batas cgroup (systemd MemoryMax) di Linux."""
from __future__ import annotations

import gc
from pathlib import Path

import psutil

MB = 1024 * 1024


def _cgroup_available_bytes() -> int | None:
    """Sisa kuota memori cgroup v2 proses ini (None jika tidak ada batas / bukan Linux)."""
    try:
        rel = Path("/proc/self/cgroup").read_text().strip().split("\n")[0].split("::", 1)[1]
        base = Path("/sys/fs/cgroup") / rel.lstrip("/")
        limit = (base / "memory.max").read_text().strip()
        if limit == "max":
            return None
        current = int((base / "memory.current").read_text().strip())
        return max(0, int(limit) - current)
    except (OSError, IndexError, ValueError):
        return None


def ram_info() -> dict:
    vm = psutil.virtual_memory()
    cg = _cgroup_available_bytes()
    available = vm.available if cg is None else min(vm.available, cg)
    return {
        "total_mb": vm.total // MB,
        "available_mb": available // MB,
        "system_available_mb": vm.available // MB,
        "cgroup_available_mb": None if cg is None else cg // MB,
        "used_percent": vm.percent,
    }


def available_mb() -> int:
    return ram_info()["available_mb"]


class NotEnoughMemory(RuntimeError):
    pass


def require_ram(needed_mb: int, purpose: str, hint: str) -> None:
    gc.collect()
    avail = available_mb()
    if avail < needed_mb:
        raise NotEnoughMemory(
            f"RAM tidak cukup untuk {purpose}: tersedia {avail} MB, dibutuhkan minimal "
            f"{needed_mb} MB. {hint}"
        )


def release_memory() -> None:
    """Kembalikan memori bebas ke OS setelah model dilepas (del + gc)."""
    gc.collect()
    try:  # glibc menahan memori bebas; malloc_trim mengembalikannya ke OS.
        import ctypes

        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass
