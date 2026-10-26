"""Bandingkan beberapa model Whisper pada satu file audio pendek.

Contoh:
    python scripts/benchmark.py contoh.wav
    python scripts/benchmark.py contoh.m4a --models small,medium,turbo --reference acuan.txt
    python scripts/benchmark.py contoh.wav --threads 4 --beam-size 1

Tiap model dijalankan di proses terpisah agar pengukuran puncak RAM akurat dan memori
model sebelumnya tidak ikut terhitung. Hasil teks disimpan per model untuk dibandingkan.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

for _stream in (sys.stdout, sys.stderr):  # konsol Windows (cp1252) tidak bisa mencetak semua karakter
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass


def peak_rss_mb() -> float:
    if os.name == "nt":
        import psutil

        return psutil.Process().memory_info().peak_wset / 1024 / 1024
    import resource

    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # Linux: KB


def run_single(args: argparse.Namespace) -> None:
    """Dijalankan di subprocess: muat satu model, transkripsi, cetak hasil JSON."""
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio

    audio = decode_audio(args.audio, sampling_rate=16000)
    duration = len(audio) / 16000
    t0 = time.perf_counter()
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type,
                         cpu_threads=args.threads, download_root=args.download_root)
    load_s = time.perf_counter() - t0
    t0 = time.perf_counter()
    segments, _ = model.transcribe(audio, language=args.language, beam_size=args.beam_size, vad_filter=True,
                                   condition_on_previous_text=False, initial_prompt=args.prompt or None)
    lines = [f"[{s.start:7.2f} - {s.end:7.2f}] {s.text.strip()}" for s in segments]
    proc_s = time.perf_counter() - t0
    print("@@RESULT@@" + json.dumps({
        "model": args.model, "audio_seconds": round(duration, 2), "load_seconds": round(load_s, 2),
        "process_seconds": round(proc_s, 2), "rtf": round(proc_s / duration, 3) if duration else None,
        "peak_ram_mb": round(peak_rss_mb()), "lines": lines,
    }, ensure_ascii=False))


def normalize(text: str) -> str:
    text = re.sub(r"\[[\d\s.:-]+\]", " ", text.lower())  # buang timestamp
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    from app.config import check_whisper_model_name, get_settings

    s = get_settings()
    ap = argparse.ArgumentParser(description="Benchmark model Whisper untuk bahasa Indonesia")
    ap.add_argument("audio", help="file audio pendek (disarankan 2–10 menit)")
    ap.add_argument("--models", default="small,medium,turbo", help="daftar model, pisahkan dengan koma")
    ap.add_argument("--reference", help="file .txt transkrip acuan (ketikan manusia) untuk menghitung WER")
    ap.add_argument("--device", default=s.whisper_device if s.whisper_device != "auto" else "cpu")
    ap.add_argument("--compute-type", default=s.whisper_compute_type)
    ap.add_argument("--threads", type=int, default=s.whisper_cpu_threads)
    ap.add_argument("--beam-size", type=int, default=s.whisper_beam_size)
    ap.add_argument("--language", default=s.whisper_language)
    ap.add_argument("--prompt", default=s.whisper_initial_prompt, help="initial_prompt Whisper")
    ap.add_argument("--download-root", default=str(s.whisper_download_root))
    ap.add_argument("--out", default="benchmark-results", help="folder output")
    ap.add_argument("--_single", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--model", help=argparse.SUPPRESS)
    args = ap.parse_args()

    if args._single:
        run_single(args)
        return

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    for m in models:
        try:
            check_whisper_model_name(m)
        except ValueError as e:
            sys.exit(f"ERROR: {e}")
    audio = Path(args.audio).resolve()
    if not audio.is_file():
        sys.exit(f"ERROR: file audio tidak ditemukan: {audio}")
    reference = None
    if args.reference:
        reference = normalize(Path(args.reference).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    results = []
    for m in models:
        print(f"\n=== {m} === (unduhan model pertama kali bisa lama)", flush=True)
        cmd = [sys.executable, __file__, str(audio), "--_single", "--model", m, "--device", args.device,
               "--compute-type", args.compute_type, "--threads", str(args.threads),
               "--beam-size", str(args.beam_size), "--language", args.language, "--prompt", args.prompt,
               "--download-root", args.download_root]
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", env=env)
        line = next((ln for ln in proc.stdout.splitlines() if ln.startswith("@@RESULT@@")), None)
        if proc.returncode != 0 or line is None:
            print(f"GAGAL (exit {proc.returncode}):\n{proc.stderr[-2000:]}")
            results.append({"model": m, "error": proc.stderr[-500:]})
            continue
        r = json.loads(line[len("@@RESULT@@"):])
        text = "\n".join(r.pop("lines"))
        (out / f"{m.replace('/', '_')}.txt").write_text(text + "\n", encoding="utf-8")
        if reference is not None:
            import jiwer

            r["wer"] = round(jiwer.wer(reference, normalize(text)), 4)
        results.append(r)
        print(f"selesai: proses {r['process_seconds']} s, RTF {r['rtf']}, puncak RAM {r['peak_ram_mb']} MB")

    (out / "results.json").write_text(json.dumps({
        "audio": str(audio), "device": args.device, "compute_type": args.compute_type,
        "threads": args.threads, "beam_size": args.beam_size, "results": results,
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\nRingkasan (RTF = detik proses per detik audio; < 1 berarti lebih cepat dari real-time)")
    hdr = f"{'Model':<16}{'Muat(s)':>9}{'Proses(s)':>11}{'RTF':>8}{'RAM(MB)':>9}{'WER':>8}  Rapat 6 jam ≈"
    print(hdr)
    print("-" * len(hdr))
    for r in results:
        if "error" in r:
            print(f"{r['model']:<16}  GAGAL")
            continue
        wer = f"{r['wer']*100:.1f}%" if "wer" in r else "-"
        est = r["rtf"] * 6 if r["rtf"] else 0
        print(f"{r['model']:<16}{r['load_seconds']:>9}{r['process_seconds']:>11}{r['rtf']:>8}"
              f"{r['peak_ram_mb']:>9}{wer:>8}  {est:.1f} jam")
    print(f"\nTeks hasil tiap model & results.json tersimpan di: {out.resolve()}")


if __name__ == "__main__":
    main()
