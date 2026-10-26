"""Jalankan service: python -m app"""
import sys

import uvicorn
from pydantic import ValidationError

from .config import get_settings

if __name__ == "__main__":
    try:
        s = get_settings()
    except ValidationError as e:
        print("Konfigurasi .env tidak valid:", file=sys.stderr)
        for err in e.errors():
            print(f"  - {'.'.join(str(x) for x in err['loc']).upper()}: {err['msg']}", file=sys.stderr)
        sys.exit(2)
    if s.host not in ("127.0.0.1", "localhost", "::1"):
        print(f"PERINGATAN: HOST={s.host} membuat service AI dapat diakses dari luar mesin ini!")
    uvicorn.run("app.main:app", host=s.host, port=s.port, workers=1, log_level=s.log_level.lower())
