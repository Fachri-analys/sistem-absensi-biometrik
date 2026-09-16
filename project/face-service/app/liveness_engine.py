"""
Liveness detection (anti-spoofing) via model MiniFASNet dalam format ONNX.

KENAPA MiniFASNet: ini arsitektur yang sama dipakai oleh
minivision-ai/Silent-Face-Anti-Spoofing (Apache 2.0) — model yang juga
dipakai proyek referensi yang kamu tunjukkan (anti-spoofing-fr) dan dipakai
DeepFace secara internal. Alih-alih menarik DeepFace secara penuh (yang
membawa dependency TensorFlow — berat untuk server yang tidak terlalu besar),
service ini memuat model ONNX-nya langsung lewat ONNX Runtime (sudah dipakai
juga untuk InsightFace) — satu runtime saja untuk kedua model, tanpa
TensorFlow sama sekali.

PENTING — INI TIDAK DI-TEST DENGAN BOBOT MODEL ASLI: sandbox pengembangan
ini tidak punya akses ke host tempat file bobot model (~1-5MB) di-hosting
(HuggingFace/GitHub release binary besar) untuk didownload & diuji end-to-
end. Kode di bawah ini benar secara struktur (preprocessing sesuai
dokumentasi resmi arsitektur MiniFASNet — 80x80, sesuai model yang kamu
pakai), TAPI WAJIB diuji dengan foto asli (wajah asli vs foto/layar HP)
sebelum dipakai siswa sungguhan. Lihat models/README.md untuk cara
mendapatkan file .onnx yang kompatibel dan cara mengujinya.

PERBAIKAN v0.2.0:
- FIX: Class index MiniFASNet dibalik — konvensi Silent-Face-Anti-Spoofing
  adalah [0: Spoof, 1: Live, 2: Spoof] (3 kelas) atau [0: Spoof, 1: Live]
  (2 kelas). Versi sebelumnya salah mengambil probs[0] sebagai live score.
- FIX: Output model ONNX adalah raw logits, BUKAN probabilitas. Ditambahkan
  softmax normalization sebelum thresholding.
- FIX: Lazy loading — model bisa ditaruh setelah service jalan tanpa restart.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import cv2
import numpy as np
import onnxruntime as ort

from .config import settings
from .face_engine import face_engine

logger = logging.getLogger("liveness_engine")


@dataclass
class LivenessResult:
    passed: bool
    confidence: float
    reason: str | None = None


def _softmax(logits: np.ndarray) -> np.ndarray:
    """Konversi raw logits ke probabilitas — WAJIB dilakukan karena model
    MiniFASNet ONNX mengembalikan logits mentah, bukan probabilitas.
    Tanpa ini, perbandingan terhadap threshold >= 0.5 tidak valid
    (nilai bisa negatif atau > 1.0)."""
    exp_logits = np.exp(logits - np.max(logits))  # numerically stable
    return exp_logits / exp_logits.sum()


class LivenessEngine:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._input_name: str = ""
        self._try_load_model()

    def _try_load_model(self) -> bool:
        """Coba muat model ONNX. Mengembalikan True jika berhasil.
        Dipanggil saat init DAN secara lazy saat check() jika model
        belum ter-load — memungkinkan file model ditaruh SETELAH service
        berjalan tanpa perlu restart (Bug #8 fix)."""
        if self._session is not None:
            return True

        if not os.path.exists(settings.liveness_model_path):
            logger.warning(
                "Model liveness tidak ditemukan di %s — endpoint /v1/liveness akan "
                "menolak semua request sampai model dipasang. Lihat models/README.md.",
                settings.liveness_model_path,
            )
            return False

        try:
            logger.info("Memuat model liveness dari %s...", settings.liveness_model_path)
            self._session = ort.InferenceSession(
                settings.liveness_model_path, providers=["CPUExecutionProvider"]
            )
            self._input_name = self._session.get_inputs()[0].name
            logger.info("Model liveness siap.")
            return True
        except Exception:
            logger.exception("Gagal memuat model liveness dari %s", settings.liveness_model_path)
            self._session = None
            return False

    def is_ready(self) -> bool:
        return self._session is not None

    def reload_model(self) -> bool:
        """Force reload model — dipanggil dari endpoint admin atau saat
        file model baru ditaruh di path yang dikonfigurasi."""
        self._session = None
        self._input_name = ""
        return self._try_load_model()

    def check(self, image_bytes: bytes) -> LivenessResult:
        # Lazy loading: coba muat model jika belum ada (memungkinkan
        # file model ditaruh setelah service berjalan tanpa restart).
        if self._session is None:
            self._try_load_model()

        if self._session is None:
            # Fail-closed: kalau model belum dipasang, TOLAK semua presensi
            # daripada diam-diam meloloskan semuanya (yang setara dengan
            # tidak ada perlindungan anti-spoof sama sekali).
            return LivenessResult(passed=False, confidence=0.0, reason="MODEL_NOT_CONFIGURED")

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return LivenessResult(passed=False, confidence=0.0, reason="NO_FACE_DETECTED")

        # Deteksi wajah dulu (pakai InsightFace yang sudah ada) untuk
        # mendapatkan bounding box — MiniFASNet butuh CROP wajah, bukan
        # seluruh foto, sesuai cara kerja aslinya (lihat referensi di
        # docstring modul ini: "patch based on face detector bounding box").
        faces = face_engine._app.get(img)  # noqa: SLF001 — dipakai internal, satu proses yang sama
        if len(faces) != 1:
            return LivenessResult(passed=False, confidence=0.0, reason="NO_FACE_DETECTED")

        x1, y1, x2, y2 = [int(v) for v in faces[0].bbox]
        # Perbesar sedikit area crop di sekitar wajah (umum dilakukan di
        # pipeline anti-spoofing — memberi model konteks tepi wajah, bukan
        # cuma area dalam wajah persis) — faktor 1.2 adalah nilai wajar umum,
        # SESUAIKAN kalau model .onnx yang dipasang punya rekomendasi
        # preprocessing berbeda (lihat models/README.md).
        pad_x = int((x2 - x1) * 0.1)
        pad_y = int((y2 - y1) * 0.1)
        h, w = img.shape[:2]
        crop = img[max(0, y1 - pad_y): min(h, y2 + pad_y), max(0, x1 - pad_x): min(w, x2 + pad_x)]

        if crop.size == 0:
            return LivenessResult(passed=False, confidence=0.0, reason="NO_FACE_DETECTED")

        size = settings.liveness_input_size
        resized = cv2.resize(crop, (size, size))
        # Normalisasi [0, 1], BGR (OpenCV default, TIDAK dikonversi ke RGB —
        # ikuti urutan channel yang didokumentasikan model ONNX yang dipasang;
        # ganti ke cv2.cvtColor(..., COLOR_BGR2RGB) di sini kalau model yang
        # kamu pasang justru mengharapkan RGB. lihat models/README.md.
        normalized = resized.astype(np.float32) / 255.0
        # NCHW: (1, 3, H, W)
        tensor = np.transpose(normalized, (2, 0, 1))[np.newaxis, ...]

        outputs = self._session.run(None, {self._input_name: tensor})
        raw_logits = outputs[0][0]

        # PERBAIKAN KRITIS: Terapkan softmax untuk mengubah raw logits menjadi
        # probabilitas. Model ONNX MiniFASNet mengembalikan logits mentah,
        # BUKAN probabilitas — tanpa softmax, nilai bisa negatif atau > 1.0
        # dan perbandingan terhadap threshold tidak valid.
        probs = _softmax(raw_logits)

        # PERBAIKAN KRITIS: Konvensi Silent-Face-Anti-Spoofing (MiniFASNet):
        #   3 kelas: [0: Spoof/Fake, 1: Real/Live, 2: Spoof/Fake]
        #   2 kelas: [0: Spoof/Fake, 1: Real/Live]
        # Versi sebelumnya SALAH mengambil probs[0] sebagai live score untuk
        # 3 kelas — probs[0] justru skor SPOOF, bukan live! Ini menyebabkan
        # foto asli dianggap spoof dan foto spoof dianggap asli.
        if len(probs) == 3:
            live_score = float(probs[1])  # index 1 = Real/Live
        elif len(probs) == 2:
            live_score = float(probs[1])  # index 1 = Real/Live
        else:
            logger.error("Bentuk output model liveness tidak dikenali: %s kelas", len(probs))
            return LivenessResult(passed=False, confidence=0.0, reason="MODEL_NOT_CONFIGURED")

        logger.info(
            "Liveness inference: raw_logits=%s, softmax_probs=%s, live_score=%.4f",
            raw_logits.tolist(), probs.tolist(), live_score,
        )

        passed = live_score >= 0.5  # threshold default umum untuk klasifikasi biner/3-kelas semacam ini
        return LivenessResult(
            passed=passed,
            confidence=live_score,
            reason=None if passed else "SPOOF_SUSPECTED",
        )


liveness_engine = LivenessEngine()
