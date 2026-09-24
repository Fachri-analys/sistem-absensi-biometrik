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
- FIX: Class index MiniFASNet dibuat eksplisit — kontrak upstream
  3-kelas adalah [0: Spoof, 1: Live, 2: Spoof]. Model 2-kelas harus
  mengatur `LIVENESS_LIVE_CLASS_INDEX` sesuai dokumentasi modelnya.
- FIX: Output model ONNX adalah raw logits, BUKAN probabilitas. Ditambahkan
  softmax normalization sebelum thresholding.
- FIX: Lazy loading — model bisa ditaruh setelah service jalan tanpa restart.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from numbers import Integral
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from .config import settings
from .face_engine import FaceModelNotReadyError, face_engine
from .liveness_processing import classify_logits, prepare_input

logger = logging.getLogger("liveness_engine")


@dataclass
class LivenessResult:
    passed: bool
    confidence: float
    reason: str | None = None


class LivenessEngine:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._input_name: str = ""
        self._input_size: int = settings.liveness_input_size
        self._output_class_count: int | None = None
        self._live_class_index: int | None = settings.liveness_live_class_index
        self._try_load_model()

    @staticmethod
    def _static_dimension(value: object) -> int | None:
        return int(value) if isinstance(value, Integral) and int(value) > 0 else None

    @staticmethod
    def _model_path() -> Path:
        configured = Path(settings.liveness_model_path).expanduser()
        if configured.is_absolute():
            return configured
        # Relative model paths are relative to face-service, not the process
        # working directory. This keeps /ready and lazy loading consistent
        # when uvicorn is started from another directory.
        return Path(__file__).resolve().parents[1] / configured

    @staticmethod
    def _crop_face(img: np.ndarray, bbox: object) -> np.ndarray:
        """Create the square scale-aware patch expected by MiniFASNet.

        The upstream 2.7_80x80 model is trained on a square patch expanded
        around the detected face. Resizing a tight rectangular bbox directly
        to a square distorts the face and changes the model contract.
        """
        coordinates = np.asarray(bbox, dtype=np.float32).reshape(-1)
        if coordinates.size != 4 or not np.all(np.isfinite(coordinates)):
            raise ValueError("Bounding box wajah tidak valid.")

        x1, y1, x2, y2 = coordinates.tolist()
        face_width = x2 - x1
        face_height = y2 - y1
        if face_width <= 0 or face_height <= 0:
            raise ValueError("Bounding box wajah kosong.")

        scale = float(settings.liveness_crop_scale)
        if not np.isfinite(scale) or scale <= 0:
            raise ValueError("Skala crop liveness harus lebih besar dari nol.")

        crop_size = max(1, int(round(max(face_width, face_height) * scale)))
        center_x = (x1 + x2) / 2.0
        center_y = (y1 + y2) / 2.0
        left = int(round(center_x - crop_size / 2.0))
        top = int(round(center_y - crop_size / 2.0))
        right = left + crop_size
        bottom = top + crop_size

        height, width = img.shape[:2]
        pad_left = max(0, -left)
        pad_top = max(0, -top)
        pad_right = max(0, right - width)
        pad_bottom = max(0, bottom - height)
        if pad_left or pad_top or pad_right or pad_bottom:
            img = cv2.copyMakeBorder(
                img,
                pad_top,
                pad_bottom,
                pad_left,
                pad_right,
                cv2.BORDER_REPLICATE,
            )
            left += pad_left
            right += pad_left
            top += pad_top
            bottom += pad_top

        crop = img[top:bottom, left:right]
        if crop.shape[:2] != (crop_size, crop_size) or crop.size == 0:
            raise ValueError("Gagal membuat crop wajah liveness.")
        return crop

    def _try_load_model(self) -> bool:
        """Coba muat model ONNX. Mengembalikan True jika berhasil.
        Dipanggil saat init DAN secara lazy saat check() jika model
        belum ter-load — memungkinkan file model ditaruh SETELAH service
        berjalan tanpa perlu restart (Bug #8 fix)."""
        if self._session is not None:
            return True

        model_path = self._model_path()
        if not model_path.is_file():
            logger.warning(
                "Model liveness tidak ditemukan di %s — endpoint /v1/liveness akan "
                "menolak semua request sampai model dipasang. Lihat models/README.md.",
                model_path,
            )
            return False

        try:
            logger.info("Memuat model liveness dari %s...", model_path)
            session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
            inputs = session.get_inputs()
            outputs = session.get_outputs()
            if len(inputs) != 1:
                raise ValueError(f"Model harus memiliki tepat satu input, ditemukan {len(inputs)}.")
            if len(outputs) != 1:
                raise ValueError(f"Model harus memiliki tepat satu output, ditemukan {len(outputs)}.")

            input_meta = inputs[0]
            if input_meta.type != "tensor(float)":
                raise ValueError(f"Tipe input model harus tensor(float), bukan {input_meta.type}.")
            input_shape = list(input_meta.shape)
            if len(input_shape) != 4:
                raise ValueError(f"Input model harus NCHW 4D, shape={input_shape}.")

            batch = self._static_dimension(input_shape[0])
            channels = self._static_dimension(input_shape[1])
            height = self._static_dimension(input_shape[2])
            width = self._static_dimension(input_shape[3])
            if batch is not None and batch != 1:
                raise ValueError(f"Batch input model harus 1, shape={input_shape}.")
            if channels is not None and channels != 3:
                raise ValueError(f"Input model harus memiliki 3 channel, shape={input_shape}.")
            if height is not None and width is not None and height != width:
                raise ValueError(f"Input model harus square, shape={input_shape}.")

            configured_size = int(settings.liveness_input_size)
            if configured_size <= 0:
                raise ValueError("LIVENESS_INPUT_SIZE harus lebih besar dari nol.")
            model_size = height or width or configured_size
            if height is not None and height != configured_size:
                raise ValueError(
                    "LIVENESS_INPUT_SIZE tidak cocok dengan model: "
                    f"konfigurasi={configured_size}, model={height}."
                )

            color_order = settings.liveness_input_color_order.strip().upper()
            if color_order not in {"BGR", "RGB"}:
                raise ValueError("LIVENESS_INPUT_COLOR_ORDER harus BGR atau RGB.")
            threshold = float(settings.liveness_threshold)
            if not 0.0 <= threshold <= 1.0:
                raise ValueError("LIVENESS_THRESHOLD harus berada pada rentang [0, 1].")
            crop_scale = float(settings.liveness_crop_scale)
            if not np.isfinite(crop_scale) or crop_scale <= 0:
                raise ValueError("LIVENESS_CROP_SCALE harus lebih besar dari nol.")

            expected_class_count = int(settings.liveness_expected_class_count)
            if expected_class_count not in {2, 3}:
                raise ValueError("LIVENESS_EXPECTED_CLASS_COUNT harus 2 atau 3.")

            output_shape = list(outputs[0].shape)
            output_class_count = None
            static_output_dims = [self._static_dimension(dim) for dim in output_shape]
            if static_output_dims and all(dim is not None for dim in static_output_dims):
                output_class_count = int(np.prod(static_output_dims))
                if output_class_count != expected_class_count:
                    raise ValueError(
                        "Jumlah kelas output model tidak sesuai konfigurasi: "
                        f"konfigurasi={expected_class_count}, shape={output_shape}."
                    )
            if settings.liveness_live_class_index is None:
                raise ValueError(
                    "LIVENESS_LIVE_CLASS_INDEX wajib diisi; service tidak "
                    "menebak mapping kelas model."
                )
            live_class_index = int(settings.liveness_live_class_index)
            if not 0 <= live_class_index < expected_class_count:
                raise ValueError(
                    f"LIVENESS_LIVE_CLASS_INDEX={live_class_index} di luar "
                    f"output {expected_class_count} kelas."
                )

            # Commit the session only after the complete contract is valid.
            self._session = session
            self._input_name = input_meta.name
            self._input_size = model_size
            self._output_class_count = expected_class_count
            self._live_class_index = live_class_index
            logger.info(
                "Model liveness siap: input=%s, color=%s, output_classes=%s, "
                "live_class=%s, threshold=%.3f, crop_scale=%.2f",
                input_shape,
                color_order,
                expected_class_count,
                live_class_index,
                threshold,
                crop_scale,
            )
            return True
        except Exception:
            logger.exception("Gagal memuat model liveness dari %s", model_path)
            self._session = None
            return False

    def is_ready(self) -> bool:
        return self._session is not None

    def reload_model(self) -> bool:
        """Force reload model — dipanggil dari endpoint admin atau saat
        file model baru ditaruh di path yang dikonfigurasi."""
        self._session = None
        self._input_name = ""
        self._output_class_count = None
        self._live_class_index = settings.liveness_live_class_index
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

        try:
            arr = np.frombuffer(image_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return LivenessResult(passed=False, confidence=0.0, reason="INVALID_IMAGE")

            # Deteksi wajah dan ambil patch square berskala. Liveness tetap
            # menjadi tahap terpisah; endpoint ini tidak membuat embedding.
            faces = face_engine.detect_primary_faces(img)
            if len(faces) == 0:
                return LivenessResult(passed=False, confidence=0.0, reason="NO_FACE_DETECTED")
            if len(faces) > 1:
                return LivenessResult(passed=False, confidence=0.0, reason="MULTIPLE_FACES")

            crop = self._crop_face(img, faces[0])
            tensor = prepare_input(
                crop,
                size=self._input_size,
                color_order=settings.liveness_input_color_order,
            )
        except (FaceModelNotReadyError, ValueError) as exc:
            logger.warning("Input liveness tidak valid", exc_info=True)
            reason = "MODEL_NOT_CONFIGURED" if isinstance(exc, FaceModelNotReadyError) else "INVALID_IMAGE"
            return LivenessResult(passed=False, confidence=0.0, reason=reason)

        try:
            outputs = self._session.run(None, {self._input_name: tensor})
            if not outputs:
                raise ValueError("Model tidak mengembalikan output.")
            raw_logits = np.asarray(outputs[0], dtype=np.float32).reshape(-1)
            if self._output_class_count is not None and len(raw_logits) != self._output_class_count:
                raise ValueError(
                    "Jumlah kelas output berubah: "
                    f"diharapkan {self._output_class_count}, didapat {len(raw_logits)}."
                )
            if self._live_class_index is None:
                raise ValueError("Mapping kelas live belum dikonfigurasi.")
            passed, live_score, probs = classify_logits(
                raw_logits,
                live_class_index=self._live_class_index,
                threshold=float(settings.liveness_threshold),
            )
            logger.info(
                "Liveness inference: raw_logits=%s, softmax_probs=%s, live_score=%.4f",
                raw_logits.tolist(), probs.tolist(), live_score,
            )
            return LivenessResult(
                passed=passed,
                confidence=live_score,
                reason=None if passed else "SPOOF_SUSPECTED",
            )
        except ValueError:
            logger.warning("Output liveness tidak valid atau kontrak model salah", exc_info=True)
            return LivenessResult(passed=False, confidence=0.0, reason="MODEL_NOT_CONFIGURED")
        except Exception:
            # Fail closed: a decode/detector/inference failure must never turn
            # into a live result or an attendance approval.
            logger.exception("Inference liveness gagal")
            return LivenessResult(passed=False, confidence=0.0, reason="INFERENCE_ERROR")


liveness_engine = LivenessEngine()
