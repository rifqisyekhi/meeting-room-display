from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class Meeting(BaseModel):
    title: str = Field(default="", max_length=500)
    # ISO 8601 (mis. "2026-10-23T09:00:00") atau teks tampilan bebas.
    datetime: str | None = None
    datetime_display: str | None = Field(default=None, description="Jika diisi, dipakai apa adanya di notulen.")
    location: str | None = None
    participants: list[str] = Field(default_factory=list)
    agenda: str | None = None


class JobOptions(BaseModel):
    # None = ikuti ENABLE_DIARIZATION; false = matikan untuk job ini.
    diarization: bool | None = None
    # Jumlah pembicara bila sudah diketahui (hasil lebih stabil). Kosong = otomatis.
    num_speakers: int | None = Field(default=None, ge=1, le=50)
    summarize: bool = True
    # Kosong = model default di .env. Harus termasuk WHISPER_ALLOWED_MODELS / model Ollama yang terpasang.
    whisper_model: str | None = Field(default=None, max_length=200)
    llm_model: str | None = Field(default=None, max_length=200)
    # Wajib true untuk model cloud (Claude): hanya dikirim backend untuk rapat berklasifikasi Biasa.
    allow_cloud: bool = False


class Segment(BaseModel):
    start: float
    end: float
    speaker: str | None = None
    text: str


class JobCreate(BaseModel):
    type: Literal["transcribe", "summarize"] = Field(
        default="transcribe",
        description="transcribe = audio → transkrip → notulen. summarize = buat ulang notulen dari transkrip.",
    )
    audio_files: list[str] = Field(default_factory=list, description="Path ABSOLUT di dalam folder storage, berurutan.")
    segments: list[Segment] = Field(default_factory=list, description="Untuk type=summarize.")
    speaker_names: dict[str, str] = Field(default_factory=dict, description='Mis. {"SPEAKER_1": "Pak Budi"}')
    meeting: Meeting = Field(default_factory=Meeting)
    options: JobOptions = Field(default_factory=JobOptions)

    @model_validator(mode="after")
    def _check(self) -> "JobCreate":
        if self.type == "transcribe" and not self.audio_files:
            raise ValueError("audio_files wajib diisi untuk type=transcribe.")
        if self.type == "summarize" and not self.segments:
            raise ValueError("segments wajib diisi untuk type=summarize.")
        if len(self.audio_files) > 500:
            raise ValueError("Terlalu banyak file audio dalam satu job (maks. 500).")
        return self


class JobOut(BaseModel):
    id: str
    type: str
    status: Literal["queued", "running", "done", "failed", "cancelled"]
    stage: str | None
    stage_label: str | None
    progress: float
    stage_progress: float
    eta_seconds: float | None
    queue_position: int | None
    attempts: int
    error: str | None
    warnings: list[str]
    created_at: float
    started_at: float | None
    finished_at: float | None
    # Transkrip sudah jadi (tersimpan di checkpoint) sementara notulen masih disusun.
    transcript_ready: bool = False
    result: dict[str, Any] | None = None
