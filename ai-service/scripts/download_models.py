"""Unduh semua model yang dibutuhkan selagi masih ada internet, agar service bisa berjalan
offline (HF_HUB_OFFLINE=true).

    python scripts/download_models.py                 # model Whisper sesuai .env
    python scripts/download_models.py --whisper small,turbo
    python scripts/download_models.py --diarization   # + model pemisahan pembicara (sherpa-onnx, ±40 MB)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main() -> None:
    from app.config import check_whisper_model_name, get_settings

    s = get_settings()
    ap = argparse.ArgumentParser()
    ap.add_argument("--whisper", default=s.whisper_model, help="model Whisper, pisahkan dengan koma")
    ap.add_argument("--diarization", action="store_true", help="unduh juga model pemisahan pembicara")
    args = ap.parse_args()

    if s.hf_hub_offline:
        sys.exit("HF_HUB_OFFLINE=true di .env. Set false sementara untuk mengunduh model.")

    from faster_whisper.utils import download_model

    for m in [x.strip() for x in args.whisper.split(",") if x.strip()]:
        check_whisper_model_name(m)
        print(f"Mengunduh Whisper '{m}' ke {s.whisper_download_root} ...", flush=True)
        path = download_model(m, cache_dir=str(s.whisper_download_root))
        print(f"  OK: {path}")

    if args.diarization:
        from app.diarizer import model_paths

        print("Mengunduh model pemisahan pembicara (sherpa-onnx) ...", flush=True)
        seg, emb = model_paths(s)
        print(f"  OK: {seg}\n  OK: {emb}")

    print("\nSelesai. Untuk Ollama jalankan juga: ollama pull", s.ollama_model)
    print("Setelah semua terunduh, set HF_HUB_OFFLINE=true di .env.")


if __name__ == "__main__":
    main()
