"""YOLO face detector backed by an exported ONNX model.

The detector deliberately does not download weights at runtime. A face-specific
YOLO model must be provisioned at ``YOLO_FACE_MODEL_PATH`` by the deployment.
The model is expected to emit decoded YOLO boxes in ``cx, cy, width, height``
format, with either ``4 + class_count`` or ``5 + class_count`` values per box.
The latter is the YOLOv5-style objectness layout.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

try:  # pragma: no cover - exercised in deployment and mocked in unit tests
    import onnxruntime as ort
except ImportError:  # pragma: no cover
    ort = None  # type: ignore[assignment]

logger = logging.getLogger("yolo_face_detector")


class YoloDetectorNotReadyError(RuntimeError):
    """Raised when the configured YOLO detector cannot serve inference."""


@dataclass(frozen=True)
class YoloDetection:
    bbox: tuple[float, float, float, float]
    confidence: float
    class_id: int


class YoloFaceDetector:
    """Small, CPU-friendly adapter for a face-specific YOLO ONNX export."""

    def __init__(
        self,
        model_path: str | Path,
        input_size: int = 640,
        confidence_threshold: float = 0.50,
        iou_threshold: float = 0.45,
        face_class_id: int | None = 0,
        class_count: int = 1,
        has_objectness: bool = False,
        normalized_output: bool = False,
        box_format: str = "cxcywh",
        max_detections: int = 20,
        session: Any | None = None,
    ) -> None:
        if input_size <= 0:
            raise ValueError("Ukuran input YOLO harus lebih besar dari nol.")
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("Threshold confidence YOLO harus berada pada rentang [0, 1].")
        if not 0.0 <= iou_threshold <= 1.0:
            raise ValueError("Threshold IoU YOLO harus berada pada rentang [0, 1].")
        if class_count <= 0:
            raise ValueError("Jumlah class YOLO harus lebih besar dari nol.")
        if face_class_id is not None and not 0 <= face_class_id < class_count:
            raise ValueError("YOLO_FACE_CLASS_ID berada di luar jumlah class model.")
        if box_format not in {"cxcywh", "xyxy"}:
            raise ValueError("Format box YOLO harus cxcywh atau xyxy.")
        if max_detections <= 0:
            raise ValueError("Maksimum deteksi YOLO harus lebih besar dari nol.")

        configured_model_path = Path(model_path).expanduser()
        self.model_path = (
            configured_model_path
            if configured_model_path.is_absolute()
            else Path(__file__).resolve().parents[1] / configured_model_path
        )
        self.input_size = int(input_size)
        self.confidence_threshold = float(confidence_threshold)
        self.iou_threshold = float(iou_threshold)
        self.face_class_id = face_class_id
        self.class_count = int(class_count)
        self.has_objectness = bool(has_objectness)
        self.normalized_output = bool(normalized_output)
        self.box_format = box_format
        self.max_detections = int(max_detections)
        self._session = session
        self._input_name: str | None = None

        if self._session is not None:
            self._input_name = self._get_input_name(self._session)
            return

        if ort is None:
            logger.warning("onnxruntime belum terpasang; YOLO face detector belum siap.")
            return
        if not self.model_path.is_file():
            logger.warning("Model YOLO face tidak ditemukan di %s.", self.model_path)
            return

        try:
            self._session = ort.InferenceSession(
                str(self.model_path),
                providers=["CPUExecutionProvider"],
            )
            self._input_name = self._get_input_name(self._session)
            logger.info("Model YOLO face siap: %s", self.model_path)
        except Exception:  # pragma: no cover - depends on a real model/runtime
            logger.exception("Gagal memuat model YOLO face dari %s", self.model_path)
            self._session = None
            self._input_name = None

    @property
    def is_ready(self) -> bool:
        return self._session is not None and self._input_name is not None

    @staticmethod
    def _get_input_name(session: Any) -> str:
        inputs = session.get_inputs()
        if not inputs or not getattr(inputs[0], "name", None):
            raise ValueError("Model YOLO tidak memiliki input tensor yang valid.")
        return str(inputs[0].name)

    def _preprocess(self, image_bgr: np.ndarray) -> tuple[np.ndarray, float, tuple[float, float]]:
        height, width = image_bgr.shape[:2]
        scale = min(self.input_size / width, self.input_size / height)
        resized_width = max(1, int(round(width * scale)))
        resized_height = max(1, int(round(height * scale)))
        resized = cv2.resize(image_bgr, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)

        canvas = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        pad_x = (self.input_size - resized_width) / 2.0
        pad_y = (self.input_size - resized_height) / 2.0
        left = int(np.floor(pad_x))
        top = int(np.floor(pad_y))
        canvas[top : top + resized_height, left : left + resized_width] = resized

        rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        tensor = rgb.astype(np.float32) / 255.0
        tensor = np.transpose(tensor, (2, 0, 1))[None, ...]
        return tensor, scale, (pad_x, pad_y)

    @staticmethod
    def _to_numpy(value: Any) -> np.ndarray:
        if hasattr(value, "detach"):
            value = value.detach()
        if hasattr(value, "cpu"):
            value = value.cpu()
        if hasattr(value, "numpy"):
            value = value.numpy()
        return np.asarray(value)

    @staticmethod
    def _probability(value: float) -> float:
        if 0.0 <= value <= 1.0:
            return value
        return float(1.0 / (1.0 + np.exp(-np.clip(value, -60.0, 60.0))))

    def _rows_from_output(self, output: Any) -> np.ndarray:
        rows = self._to_numpy(output).astype(np.float32, copy=False)
        while rows.ndim > 2 and rows.shape[0] == 1:
            rows = rows[0]
        if rows.ndim != 2:
            raise ValueError(f"Output YOLO harus tensor 2D setelah batch squeeze, dapat {rows.shape}.")

        feature_count = 4 + self.class_count + (1 if self.has_objectness else 0)
        # ONNX exports commonly use either [features, predictions] or
        # [predictions, features]. Only transpose when one dimension cannot
        # contain the configured feature contract; this avoids misreading a
        # small test/model output such as [3 predictions, 6 features].
        if rows.shape[1] < feature_count <= rows.shape[0] or (
            rows.shape[0] <= feature_count and rows.shape[1] > feature_count
        ):
            rows = rows.T
        if rows.shape[1] < feature_count:
            raise ValueError(
                f"Output YOLO memiliki {rows.shape[1]} feature, minimal {feature_count} diperlukan."
            )
        return rows

    def _decode_box(
        self,
        row: np.ndarray,
        scale: float,
        padding: tuple[float, float],
        image_shape: tuple[int, int],
    ) -> tuple[float, float, float, float]:
        coords = row[:4].astype(np.float32, copy=False)
        if self.normalized_output:
            coords = coords * self.input_size

        if self.box_format == "xyxy":
            x1, y1, x2, y2 = (float(value) for value in coords)
        else:
            center_x, center_y, box_width, box_height = (float(value) for value in coords)
            x1 = center_x - box_width / 2.0
            y1 = center_y - box_height / 2.0
            x2 = center_x + box_width / 2.0
            y2 = center_y + box_height / 2.0

        pad_x, pad_y = padding
        x1 = (x1 - pad_x) / scale
        y1 = (y1 - pad_y) / scale
        x2 = (x2 - pad_x) / scale
        y2 = (y2 - pad_y) / scale
        height, width = image_shape
        return (
            max(0.0, min(float(width), x1)),
            max(0.0, min(float(height), y1)),
            max(0.0, min(float(width), x2)),
            max(0.0, min(float(height), y2)),
        )

    @staticmethod
    def _iou(box_a: tuple[float, float, float, float], box_b: tuple[float, float, float, float]) -> float:
        ax1, ay1, ax2, ay2 = box_a
        bx1, by1, bx2, by2 = box_b
        inter_x1 = max(ax1, bx1)
        inter_y1 = max(ay1, by1)
        inter_x2 = min(ax2, bx2)
        inter_y2 = min(ay2, by2)
        inter_area = max(0.0, inter_x2 - inter_x1) * max(0.0, inter_y2 - inter_y1)
        area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
        area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
        union = area_a + area_b - inter_area
        return inter_area / union if union > 0.0 else 0.0

    def _nms(self, detections: list[YoloDetection]) -> list[YoloDetection]:
        kept: list[YoloDetection] = []
        for candidate in sorted(detections, key=lambda item: item.confidence, reverse=True):
            if all(
                candidate.class_id != previous.class_id
                or self._iou(candidate.bbox, previous.bbox) < self.iou_threshold
                for previous in kept
            ):
                kept.append(candidate)
            if len(kept) >= self.max_detections:
                break
        return kept

    def detect(self, image_bgr: np.ndarray) -> list[YoloDetection]:
        if not self.is_ready:
            raise YoloDetectorNotReadyError("Model YOLO face belum siap.")
        if image_bgr is None or image_bgr.ndim != 3 or image_bgr.shape[2] != 3:
            raise ValueError("Input YOLO harus berupa image BGR dengan tiga channel.")

        tensor, scale, padding = self._preprocess(image_bgr)
        outputs = self._session.run(None, {self._input_name: tensor})
        if not outputs:
            raise ValueError("Model YOLO tidak mengembalikan output.")

        rows = self._rows_from_output(outputs[0])
        detections: list[YoloDetection] = []
        for row in rows:
            class_offset = 5 if self.has_objectness else 4
            class_scores = row[class_offset : class_offset + self.class_count]
            if self.has_objectness:
                objectness = self._probability(float(row[4]))
            else:
                objectness = 1.0
            class_id = int(np.argmax(class_scores))
            confidence = objectness * self._probability(float(class_scores[class_id]))
            if confidence < self.confidence_threshold:
                continue
            if self.face_class_id is not None and class_id != self.face_class_id:
                continue
            bbox = self._decode_box(row, scale, padding, image_bgr.shape[:2])
            if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                continue
            detections.append(YoloDetection(bbox=bbox, confidence=confidence, class_id=class_id))

        return self._nms(detections)
