"""
docs/06-SECURITY-SPEC.md §Biometric Security: embedding tidak boleh beredar
sebagai vektor mentah di luar service yang berwenang menanganinya. Modul ini
memastikan itu — Next.js APP menyimpan `embeddingRef` sebagai string opaque,
TIDAK PERNAH mendekripsinya sendiri. Hanya face-service (di sini) yang punya
embedding_encryption_key untuk membuka isinya kembali saat perbandingan.
"""

import base64
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import numpy as np

from fastapi import Header, HTTPException, status

from .config import settings


def _get_aesgcm() -> AESGCM:
    key = base64.b64decode(settings.embedding_encryption_key)
    if len(key) != 32:
        raise RuntimeError(
            "EMBEDDING_ENCRYPTION_KEY harus 32 byte (AES-256) setelah di-decode base64."
        )
    return AESGCM(key)


def encrypt_embedding(vector: list[float], version: str) -> str:
    """
    Mengembalikan string opaque (base64) berisi nonce + ciphertext.
    APP menyimpan hasil ini apa adanya sebagai biometric_profiles.embedding_ref.
    """
    aesgcm = _get_aesgcm()
    nonce = os.urandom(12)  # AES-GCM standar: nonce 96-bit, JANGAN dipakai ulang untuk kunci yang sama
    plaintext = json.dumps({"v": vector, "ver": version}).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_embedding(embedding_ref: str) -> tuple[list[float], str]:
    """Kebalikan dari encrypt_embedding — melempar ValueError kalau ref rusak/dipalsukan."""
    aesgcm = _get_aesgcm()
    try:
        raw = base64.b64decode(embedding_ref)
        nonce, ciphertext = raw[:12], raw[12:]
        plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
        data = json.loads(plaintext)
        if "centroid" in data:
            return data["centroid"], data["ver"]
        return data["v"], data["ver"]
    except Exception as exc:  # noqa: BLE001 — sengaja tangkap luas, semua kegagalan berarti ref tidak valid
        raise ValueError("embeddingRef tidak valid atau rusak.") from exc


def encrypt_multi_embedding(vectors: list[list[float]], version: str) -> str:
    """
    Encrypts multiple vectors and their normalized centroid into a single reference.
    """
    aesgcm = _get_aesgcm()
    nonce = os.urandom(12)
    # Compute centroid: average all vectors, then L2-normalize it
    centroid = np.mean(vectors, axis=0)
    norm = float(np.linalg.norm(centroid))
    if norm > 1e-12:
        centroid = centroid / norm
    
    plaintext = json.dumps({
        "vectors": vectors,
        "centroid": centroid.tolist(),
        "ver": version,
        "n": len(vectors)
    }).encode("utf-8")
    
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_embedding_vectors(embedding_ref: str) -> tuple[list[list[float]], str]:
    """
    Decrypts embedding ref and returns a list of vectors.
    Backward compatible with single-vector format.
    """
    aesgcm = _get_aesgcm()
    try:
        raw = base64.b64decode(embedding_ref)
        nonce, ciphertext = raw[:12], raw[12:]
        plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
        data = json.loads(plaintext)
        if "vectors" in data:
            return data["vectors"], data["ver"]
        if "v" in data:
            return [data["v"]], data["ver"]
        raise ValueError("Unknown payload format")
    except Exception as exc:
        raise ValueError("embeddingRef tidak valid atau rusak.") from exc


async def require_internal_key(x_internal_service_key: str = Header(default="")) -> None:
    """
    Dependency FastAPI — dipasang di SETIAP endpoint. Service ini TIDAK
    PERNAH dipanggil langsung dari browser siswa; hanya dari Next.js APP
    (server-ke-server) yang memegang key yang sama. Bandingkan dengan pola
    X-Camera-Key di src/lib/require-auth.ts pada APP Next.js — konsepnya
    sama: shared secret untuk komunikasi antar-service tepercaya.
    """
    if not x_internal_service_key or x_internal_service_key != settings.internal_service_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Internal-Service-Key tidak valid atau tidak ada.",
        )
