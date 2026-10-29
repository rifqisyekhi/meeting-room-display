"""Pengolahan teks transkrip: label pembicara per kata, format baris berwaktu, pemotongan."""
from __future__ import annotations

import bisect
import re


def fmt_ts(seconds: float) -> str:
    s = int(max(0, seconds))
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def _speaker_for(start: float, end: float, turns: list[tuple[float, float, str]],
                 starts: list[float]) -> str | None:
    """Pembicara dengan overlap terbesar terhadap [start, end]; jika tidak ada, yang terdekat."""
    if not turns:
        return None
    i = bisect.bisect_left(starts, end)
    best, best_ov = None, 0.0
    # Giliran bicara diurutkan menurut waktu mulai; periksa beberapa giliran sebelum `end`.
    for j in range(i - 1, max(-1, i - 30), -1):
        t0, t1, spk = turns[j]
        ov = min(end, t1) - max(start, t0)
        if ov > best_ov:
            best, best_ov = spk, ov
    if best is not None:
        return best
    mid = (start + end) / 2
    cand = [turns[k] for k in (i - 1, i) if 0 <= k < len(turns)]
    return min(cand, key=lambda t: min(abs(mid - t[0]), abs(mid - t[1])))[2]


def assign_speakers(words: list[dict], turns: list[tuple[float, float, str]],
                    merge_gap: float) -> list[dict]:
    """Beri label pembicara pada setiap kata, lalu gabungkan kata berurutan dari pembicara
    yang sama menjadi satu ucapan."""
    turns = sorted(turns)
    starts = [t[0] for t in turns]
    out: list[dict] = []
    for w in words:
        text = w["word"]
        if not text.strip():
            continue
        spk = _speaker_for(w["start"], w["end"], turns, starts)
        last = out[-1] if out else None
        if last and last["speaker"] == spk and w["start"] - last["end"] <= merge_gap:
            last["text"] += text
            last["end"] = w["end"]
        else:
            out.append({"start": w["start"], "end": w["end"], "speaker": spk, "text": text})
    for seg in out:
        seg["text"] = re.sub(r"\s+", " ", seg["text"]).strip()
    return out


def transcript_lines(segments: list[dict], speaker_names: dict[str, str] | None = None) -> list[str]:
    names = speaker_names or {}
    lines = []
    for seg in segments:
        text = seg["text"].strip()
        if not text:
            continue
        spk = seg.get("speaker")
        label = f" {names.get(spk) or spk}:" if spk else ""
        lines.append(f"[{fmt_ts(seg['start'])}]{label} {text}")
    return lines


def chunk_lines(lines: list[str], max_chars: int) -> list[str]:
    """Kelompokkan baris menjadi potongan ≤ max_chars, memotong hanya di batas baris
    (baris yang sendirian sudah terlalu panjang dipotong di batas kata)."""
    chunks: list[str] = []
    cur: list[str] = []
    size = 0
    for line in lines:
        pieces = [line]
        if len(line) > max_chars:
            pieces, buf = [], ""
            for word in line.split(" "):
                if buf and len(buf) + 1 + len(word) > max_chars:
                    pieces.append(buf)
                    buf = word
                else:
                    buf = f"{buf} {word}" if buf else word
            if buf:
                pieces.append(buf)
        for p in pieces:
            if cur and size + len(p) + 1 > max_chars:
                chunks.append("\n".join(cur))
                cur, size = [], 0
            cur.append(p)
            size += len(p) + 1
    if cur:
        chunks.append("\n".join(cur))
    return chunks


_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def clean_llm_output(text: str) -> str:
    text = _THINK_RE.sub("", text)
    # Tag <think> yang tidak ditutup (output terpotong): buang sampai akhir teks.
    text = re.sub(r"<think>.*$", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</think>", "", text, flags=re.IGNORECASE).strip()
    fence = re.match(r"^```(?:markdown|md)?\s*\n(.*?)\n```\s*$", text, re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    return text
