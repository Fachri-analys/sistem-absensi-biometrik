import unittest

import numpy as np

from app.liveness_processing import classify_logits, prepare_input


class LivenessProcessingTests(unittest.TestCase):
    def test_upstream_three_class_live_and_spoof_mapping(self) -> None:
        live_passed, live_score, _ = classify_logits(
            np.array([-2.0, 5.0, -2.0]),
            live_class_index=1,
            threshold=0.5,
        )
        spoof_passed, spoof_score, _ = classify_logits(
            np.array([5.0, -2.0, 4.0]),
            live_class_index=1,
            threshold=0.5,
        )

        self.assertTrue(live_passed)
        self.assertGreater(live_score, 0.5)
        self.assertFalse(spoof_passed)
        self.assertLess(spoof_score, 0.5)

    def test_two_class_real_first_mapping_is_explicit(self) -> None:
        real_passed, _, _ = classify_logits(
            np.array([5.0, -2.0]),
            live_class_index=0,
            threshold=0.5,
        )
        spoof_passed, _, _ = classify_logits(
            np.array([-2.0, 5.0]),
            live_class_index=0,
            threshold=0.5,
        )

        self.assertTrue(real_passed)
        self.assertFalse(spoof_passed)

    def test_preprocessing_is_float32_nchw_and_configurable_rgb(self) -> None:
        # OpenCV image: channel 0 is B, channel 2 is R.
        crop = np.zeros((2, 2, 3), dtype=np.uint8)
        crop[..., 0] = 10
        crop[..., 2] = 200

        bgr = prepare_input(crop, size=2, color_order="BGR")
        rgb = prepare_input(crop, size=2, color_order="RGB")

        self.assertEqual(bgr.shape, (1, 3, 2, 2))
        self.assertEqual(bgr.dtype, np.float32)
        self.assertAlmostEqual(float(bgr[0, 0, 0, 0]), 10 / 255)
        self.assertAlmostEqual(float(bgr[0, 2, 0, 0]), 200 / 255)
        self.assertAlmostEqual(float(rgb[0, 0, 0, 0]), 200 / 255)
        self.assertAlmostEqual(float(rgb[0, 2, 0, 0]), 10 / 255)

    def test_invalid_class_mapping_fails_closed_at_processing_boundary(self) -> None:
        with self.assertRaises(ValueError):
            classify_logits(np.array([1.0, 0.0]), live_class_index=2, threshold=0.5)


if __name__ == "__main__":
    unittest.main()
