"""
face-service — microservice Python internal, DIPANGGIL OLEH Next.js APP
(src/lib/face-recognition.ts, implementasi HttpFaceRecognitionEngine),
BUKAN diekspos ke internet/siswa secara langsung.

Endpoint di sini adalah implementasi KONKRET dari interface
FaceRecognitionEngine (docs di src/lib/face-recognition.ts pada project
Next.js) — method di sana (validatePhotoQuality, checkLiveness,
generateEmbedding, compareEmbeddings) memetakan 1:1 ke endpoint di bawah.

VERSION: v0.1.0 (mock/InsightFace+MiniFASNet, belum dievaluasi formal —
lihat README.md).
"""

from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from .config import settings
from .face_engine import face_engine
from .liveness_engine import liveness_engine
from .schemas import (
    CompareRequest,
    CompareResponse,
    EmbeddingResponse,
    LivenessResponse,
    QualityResponse,
)
from .security import decrypt_embedding, encrypt_embedding, require_internal_key

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-service")

app = FastAPI(title="Face Service — Sistem Absensi Biometrik", version="0.1.0")

EMBEDDING_VERSION = "insightface-buffalo_l-v1"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB, konsisten dengan batas di Next.js APP


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran file melebihi batas 5MB.",
        )
    if len(data) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File kosong.")
    return data


@app.get("/health")
async def health() -> dict:
    """Liveness check proses — TIDAK butuh auth, dipakai orchestrator/health monitor saja."""
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> JSONResponse:
    """
    Readiness check — memverifikasi model InsightFace ter-load DAN model
    liveness terpasang. Beda dengan /health (docs/12-OPERATIONS.md §3 pada
    project Next.js, prinsip yang sama diterapkan di sini).
    """
    checks = {
        "insightface": "ok",  # kalau modul ini berhasil diimpor, InsightFace sudah ter-load (lihat face_engine.py)
        "liveness_model": "ok" if liveness_engine.is_ready() else "not_configured",
    }
    is_ready = checks["liveness_model"] == "ok"
    return JSONResponse(
        content={"status": "ready" if is_ready else "not_ready", "checks": checks},
        status_code=200 if is_ready else 503,
    )


@app.post("/v1/quality", response_model=QualityResponse, dependencies=[Depends(require_internal_key)])
async def check_quality(photo: UploadFile = File(...)) -> QualityResponse:
    """
    FR-ENROLL-003 — validasi foto STATIS (rapor) sebelum generate embedding
    saat enrolment. TIDAK melakukan liveness check (foto rapor bukan capture
    langsung, tidak relevan memeriksa "hidup atau tidak").
    """
    data = await _read_upload(photo)
    try:
        result = face_engine.check_quality(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return QualityResponse(is_valid=result.is_valid, reason=result.reason)


@app.post("/v1/liveness", response_model=LivenessResponse, dependencies=[Depends(require_internal_key)])
async def check_liveness(photo: UploadFile = File(...)) -> LivenessResponse:
    """
    Dipakai saat PRESENSI (capture langsung dari HP siswa) — SEBELUM
    generate embedding (lihat urutan di src/app/api/attendance/checkin/route.ts
    pada project Next.js: liveness dulu, baru embedding, supaya foto/video
    spoof tidak perlu diproses lebih jauh).
    """
    data = await _read_upload(photo)
    result = liveness_engine.check(data)
    return LivenessResponse(passed=result.passed, confidence=result.confidence, reason=result.reason)


@app.post("/v1/reload-liveness", dependencies=[Depends(require_internal_key)])
async def reload_liveness() -> dict:
    """
    Muat ulang file model liveness ONNX dari disk tanpa perlu me-restart proses service.
    Berguna saat file model minifasnet.onnx baru dipasang/diperbarui.
    """
    success = liveness_engine.reload_model()
    return {
        "status": "ok" if success else "failed",
        "is_ready": liveness_engine.is_ready(),
        "model_path": settings.liveness_model_path,
    }


@app.post("/v1/embedding", response_model=EmbeddingResponse, dependencies=[Depends(require_internal_key)])
async def generate_embedding(photo: UploadFile = File(...)) -> EmbeddingResponse:
    """
    Dipakai saat enrolment (foto rapor) MAUPUN presensi (live capture, hanya
    dipanggil KALAU liveness sudah lolos — lihat komentar di
    src/app/api/attendance/checkin/route.ts). Mengembalikan embeddingRef
    yang SUDAH TERENKRIPSI (lihat security.py) — APP Next.js menyimpannya
    sebagai string opaque, tidak pernah melihat vektor mentahnya.
    """
    data = await _read_upload(photo)
    try:
        detected = face_engine.detect_single_face(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Wajah tidak terdeteksi atau lebih dari satu wajah pada foto.",
        )

    embedding_ref = encrypt_embedding(detected.embedding.tolist(), EMBEDDING_VERSION)
    return EmbeddingResponse(embedding_ref=embedding_ref, embedding_version=EMBEDDING_VERSION)


@app.post("/v1/compare", response_model=CompareResponse, dependencies=[Depends(require_internal_key)])
async def compare_embeddings(body: CompareRequest) -> CompareResponse:
    """
    Perbandingan 1:1 — SATU live capture vs SATU template tersimpan (bukan
    1:N ke seluruh basis siswa), sesuai keputusan arsitektur di
    src/lib/face-recognition.ts pada project Next.js: siswa mengetik NISN
    sendiri, sistem sudah tahu siapa yang diklaim.
    """
    try:
        live_vec, _ = decrypt_embedding(body.live_embedding_ref)
        stored_vec, _ = decrypt_embedding(body.stored_embedding_ref)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    similarity = face_engine.cosine_similarity(live_vec, stored_vec)
    return CompareResponse(similarity=similarity)
