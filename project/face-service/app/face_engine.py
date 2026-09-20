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
try:
    from insightface.app import FaceAnalysis
except ImportError:  # pragma: no cover
    FaceAnalysis = None  # type: ignore

from .config import settings

logger = logging.getLogger("face_engine")


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

    def __init__(self, app: FaceAnalysis | None = None) -> None:
        if app is not None:
            self._app = app
        elif FaceAnalysis is not None:
            logger.info("Memuat model InsightFace (%s)...", settings.insightface_model_name)
            self._app = FaceAnalysis(
                name=settings.insightface_model_name,
                providers=["CPUExecutionProvider"],
            )
            self._app.prepare(ctx_id=0, det_size=(640, 640))
            logger.info("Model InsightFace siap.")
        else:
            logger.warning("InsightFace belum terpasang. FaceEngine menunggu inisialisasi model.")
            self._app = None

    def _decode_image(self, image_bytes: bytes) -> np.ndarray:
        if not image_bytes:
            raise ValueError("File kosong.")
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Gagal decode gambar — format tidak didukung atau file rusak.")
        return img

    def extract_face_with_quality(self, image_bytes: bytes) -> tuple[DetectedFace | None, QualityResult]:
        """
        Melakukan pemeriksaan kualitas foto secara komprehensif sebelum ekstraksi face embedding.
        Memeriksa:
        1. Integritas / format gambar (invalid_image)
        2. Resolusi gambar (invalid_image)
        3. Tingkat blur / ketajaman (image_too_blurry)
        4. Brightness / pencahayaan (poor_lighting)
        5. Keberadaan wajah (no_face / multiple_faces)
        6. Ukuran wajah minimum (face_too_small)
        7. Wajah terpotong di tepi gambar (face_cropped)
        8. Pose wajah ekstrem (extreme_pose)
        """
        try:
            img = self._decode_image(image_bytes)
        except ValueError:
            return None, QualityResult(is_valid=False, reason="invalid_image")

        h, w = img.shape[:2]
        if w < settings.min_image_width or h < settings.min_image_height:
            return None, QualityResult(is_valid=False, reason="invalid_image")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if blur_score < settings.blur_threshold:
            return None, QualityResult(is_valid=False, reason="image_too_blurry")

        mean_brightness = float(np.mean(gray))
        if mean_brightness < settings.min_brightness or mean_brightness > settings.max_brightness:
            return None, QualityResult(is_valid=False, reason="poor_lighting")

        if self._app is None:
            raise RuntimeError("InsightFace model belum diinisialisasi.")

        faces = self._app.get(img)
        if len(faces) == 0:
            return None, QualityResult(is_valid=False, reason="no_face")
        if len(faces) > 1:
            return None, QualityResult(is_valid=False, reason="multiple_faces")

        face = faces[0]
        x1, y1, x2, y2 = face.bbox
        face_w = float(x2 - x1)
        face_h = float(y2 - y1)
        if face_w < settings.min_face_size or face_h < settings.min_face_size:
            return None, QualityResult(is_valid=False, reason="face_too_small")

        margin = settings.crop_margin_px
        if x1 <= margin or y1 <= margin or x2 >= (w - margin) or y2 >= (h - margin):
            return None, QualityResult(is_valid=False, reason="face_cropped")

        # Pemeriksaan pose ekstrem (pitch, yaw, roll)
        pose = getattr(face, "pose", None) if hasattr(face, "pose") else (face.get("pose") if isinstance(face, dict) else None)
        if pose is not None:
            pitch, yaw, roll = float(pose[0]), float(pose[1]), float(pose[2])
            if abs(yaw) > settings.max_yaw or abs(pitch) > settings.max_pitch or abs(roll) > settings.max_roll:
                return None, QualityResult(is_valid=False, reason="extreme_pose")

        # Pemeriksaan pose via 5 facial landmarks (kps) sebagai penguat atau alternatif
        kps = getattr(face, "kps", None) if hasattr(face, "kps") else (face.get("kps") if isinstance(face, dict) else None)
        if kps is not None and len(kps) >= 5:
            # Kemiringan kepala (roll) berdasarkan garis mata kiri dan kanan
            dx = float(kps[1][0] - kps[0][0])
            dy = float(kps[1][1] - kps[0][1])
            roll_deg = abs(float(np.degrees(np.arctan2(dy, dx))))
            if roll_deg > settings.max_roll:
                return None, QualityResult(is_valid=False, reason="extreme_pose")

            # Asimetri mata-hidung untuk mendeteksi wajah menoleh (yaw)
            d_left = abs(float(kps[2][0] - kps[0][0]))
            d_right = abs(float(kps[1][0] - kps[2][0]))
            yaw_ratio = abs(d_left - d_right) / max(d_left + d_right, 1e-6)
            if yaw_ratio > settings.max_yaw_ratio:
                return None, QualityResult(is_valid=False, reason="extreme_pose")

        normed_emb = getattr(face, "normed_embedding", None)
        if normed_emb is None and hasattr(face, "embedding"):
            normed_emb = face.embedding / np.linalg.norm(face.embedding)

        detected = DetectedFace(embedding=normed_emb, bbox=tuple(face.bbox))
        return detected, QualityResult(is_valid=True, reason=None)

    def check_quality(self, image_bytes: bytes) -> QualityResult:
        """
        Validasi kualitas foto sebelum enrolment maupun presensi.
        Mengembalikan is_valid dan reason spesifik jika tidak valid.
        """
        _, quality = self.extract_face_with_quality(image_bytes)
        return quality

    def detect_single_face(self, image_bytes: bytes) -> DetectedFace | None:
        """
        Deteksi dan validasi wajah tunggal. Mengembalikan DetectedFace jika kualitas
        memenuhi syarat, atau None jika tidak lolos validasi.
        """
        detected, _ = self.extract_face_with_quality(image_bytes)
        return detected

    @staticmethod
    def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        denom = (np.linalg.norm(a) * np.linalg.norm(b))
        if denom == 0:
            return 0.0
        raw = float(np.dot(a, b) / denom)
        return max(0.0, min(1.0, raw))


# Instance tunggal, di-load sekali saat modul pertama diimpor (saat FastAPI startup).
face_engine = FaceEngine()

