"""
Face detection + embedding via InsightFace (buffalo_l) — model open-source,
Apache 2.0/MIT (lisensi per model di model zoo InsightFace), sudah
diverifikasi berhasil di-load & dijalankan sebelum service ini ditulis.

CATATAN JUJUR: InsightFace buffalo_l dipilih (bukan library lain) karena
ringan (murni ONNX Runtime, tidak butuh TensorFlow/PyTorch saat inference),
akurat untuk kasus umum, dan terbukti berhasil didownload & dijalankan saat
pengembangan service ini. TIDAK ada klaim independen soal akurasi spesifik
untuk populasi wajah Indonesia — kalau sekolah punya data untuk mengevaluasi
false-accept/false-reject rate di populasi siswa sungguhan, sangat
direkomendasikan sebelum rollout penuh (lihat docs/10-TEST-PLAN.md).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from .config import settings

logger = logging.getLogger("face_engine")

_MIN_RESOLUTION_PX = 200  # sisi terpendek foto minimal, proxy kasar kualitas foto
_BLUR_THRESHOLD = 80.0  # varians Laplacian di bawah ini dianggap buram (nilai umum dipakai literatur OpenCV)


@dataclass
class QualityResult:
    is_valid: bool
    reason: str | None = None


@dataclass
class DetectedFace:
    embedding: np.ndarray  # vektor 512-dim (buffalo_l)
    bbox: tuple[float, float, float, float]


class FaceEngine:
    """Singleton wrapper — model InsightFace di-load SEKALI saat startup, dipakai ulang di semua request."""

    def __init__(self) -> None:
        logger.info("Memuat model InsightFace (%s)...", settings.insightface_model_name)
        self._app = FaceAnalysis(
            name=settings.insightface_model_name,
            providers=["CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("Model InsightFace siap.")

    def _decode_image(self, image_bytes: bytes) -> np.ndarray:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Gagal decode gambar — format tidak didukung atau file rusak.")
        return img

    def check_quality(self, image_bytes: bytes) -> QualityResult:
        """
        Dipakai saat ENROLMENT (foto rapor, statis) — FR-ENROLL-003.
        Mengecek: tepat satu wajah, resolusi cukup, tidak buram.
        """
        img = self._decode_image(image_bytes)

        h, w = img.shape[:2]
        if min(h, w) < _MIN_RESOLUTION_PX:
            return QualityResult(is_valid=False, reason="LOW_RESOLUTION")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < _BLUR_THRESHOLD:
            return QualityResult(is_valid=False, reason="BLURRY")

        faces = self._app.get(img)
        if len(faces) == 0:
            return QualityResult(is_valid=False, reason="NO_FACE_DETECTED")
        if len(faces) > 1:
            return QualityResult(is_valid=False, reason="MULTIPLE_FACES")

        return QualityResult(is_valid=True)

    def detect_single_face(self, image_bytes: bytes) -> DetectedFace | None:
        """
        Dipakai saat PRESENSI (live capture dari HP siswa). Mengembalikan
        None kalau tidak ada wajah / lebih dari satu wajah terdeteksi —
        pemanggil (main.py) yang memutuskan bagaimana merespons kasus itu.
        """
        img = self._decode_image(image_bytes)
        faces = self._app.get(img)

        if len(faces) != 1:
            return None

        face = faces[0]
        return DetectedFace(embedding=face.normed_embedding, bbox=tuple(face.bbox))

    @staticmethod
    def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        denom = (np.linalg.norm(a) * np.linalg.norm(b))
        if denom == 0:
            return 0.0
        raw = float(np.dot(a, b) / denom)
        # normed_embedding InsightFace sudah unit-length (norm = 1.0).
        # Raw cosine similarity berada di rentang [-1.0, 1.0], dan untuk wajah
        # manusia bernilai antara 0.0 s/d 1.0 (wajah berbeda ~0.0-0.25, wajah sama ~0.40-0.75).
        # Kita clamp ke [0.0, 1.0] langsung tanpa transformasi linear (raw + 1)/2
        # agar sesuai dengan standar benchmark ArcFace/InsightFace di mana threshold
        # ~0.40 memberikan False Accept Rate (FAR) rendah dan False Reject Rate (FRR) optimal.
        return max(0.0, min(1.0, raw))


# Instance tunggal, di-load sekali saat modul pertama diimpor (saat FastAPI startup).
face_engine = FaceEngine()
