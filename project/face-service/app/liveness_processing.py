"""Pure MiniFASNet input/output processing helpers.

Keeping these operations separate from ONNX Runtime makes the model contract
explicit and lets us test class mapping without needing model weights.
"""

from __future__ import annotations

import cv2
import numpy as np


def softmax(logits: np.ndarray) -> np.ndarray:
    """Convert one-dimensional MiniFASNet logits to probabilities."""
    values = np.asarray(logits, dtype=np.float32).reshape(-1)
    if values.size == 0 or not np.all(np.isfinite(values)):
        raise ValueError("Output liveness kosong atau bukan angka finite.")

    shifted = values - np.max(values)
    exp_values = np.exp(shifted)
    denominator = float(exp_values.sum())
    if not np.isfinite(denominator) or denominator <= 0:
        raise ValueError("Output liveness tidak dapat dinormalisasi.")
    return exp_values / denominator


def classify_logits(
    logits: np.ndarray,
    *,
    live_class_index: int,
    threshold: float,
) -> tuple[bool, float, np.ndarray]:
    """Return ``(passed, live_probability, probabilities)``.

    The class index is deliberately supplied by the configured model contract;
    it must not be inferred from whether the model has two or three outputs.
    """
    probabilities = softmax(logits)
    if not 0 <= live_class_index < probabilities.size:
        raise ValueError(
            f"Index kelas live {live_class_index} di luar output "
            f"{probabilities.size} kelas."
        )
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("Threshold liveness harus berada pada rentang [0, 1].")

    live_probability = float(probabilities[live_class_index])
    return live_probability >= threshold, live_probability, probabilities


def prepare_input(crop: np.ndarray, *, size: int, color_order: str) -> np.ndarray:
    """Resize a BGR OpenCV crop and produce a float32 NCHW tensor.

    MiniFASNet variants in this service use pixel/255 normalization. The
    channel conversion is explicit because some compatible custom models are
    trained with RGB rather than the upstream BGR contract.
    """
    if size <= 0:
        raise ValueError("Ukuran input liveness harus lebih besar dari nol.")
    if crop.ndim != 3 or crop.shape[2] != 3 or crop.size == 0:
        raise ValueError("Crop wajah harus berupa citra BGR 3-channel yang tidak kosong.")

    normalized_order = color_order.strip().upper()
    if normalized_order not in {"BGR", "RGB"}:
        raise ValueError("Urutan channel liveness harus BGR atau RGB.")

    resized = cv2.resize(crop, (size, size), interpolation=cv2.INTER_LINEAR)
    if normalized_order == "RGB":
        resized = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

    tensor = resized.astype(np.float32) / 255.0
    return np.transpose(tensor, (2, 0, 1))[np.newaxis, ...]
