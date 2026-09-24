"""Optional end-to-end liveness test for a locally supplied dataset.

The repository intentionally does not include biometric images or model
weights. Set LIVENESS_TEST_DATASET_DIR to a folder containing live/ and spoof/
subdirectories to enable this test in an environment with the face-service
dependencies installed.
"""

from __future__ import annotations

import os
import unittest
from pathlib import Path


class LivenessDatasetTests(unittest.TestCase):
    def test_live_and_spoof_samples(self) -> None:
        dataset_dir = os.environ.get("LIVENESS_TEST_DATASET_DIR")
        if not dataset_dir:
            self.skipTest("LIVENESS_TEST_DATASET_DIR tidak diisi; dataset tidak tersedia.")

        root = Path(dataset_dir)
        live_files = sorted(self._image_files(root / "live"))
        spoof_files = sorted(self._image_files(root / "spoof"))
        if not live_files or not spoof_files:
            self.skipTest("Dataset harus memiliki file pada subfolder live/ dan spoof/.")

        try:
            from app.liveness_engine import LivenessEngine
        except (ImportError, ModuleNotFoundError) as exc:
            self.skipTest(f"Dependency face-service belum terpasang: {exc}")

        engine = LivenessEngine()
        if not engine.is_ready():
            self.skipTest("Model liveness tidak siap; pasang model dan konfigurasi .env.")

        for image_path in live_files:
            result = engine.check(image_path.read_bytes())
            self.assertTrue(result.passed, f"Foto live ditolak: {image_path} -> {result}")

        for image_path in spoof_files:
            result = engine.check(image_path.read_bytes())
            self.assertFalse(result.passed, f"Foto spoof lolos: {image_path} -> {result}")

    @staticmethod
    def _image_files(directory: Path) -> list[Path]:
        if not directory.is_dir():
            return []
        return [
            path
            for path in directory.iterdir()
            if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        ]


if __name__ == "__main__":
    unittest.main()
