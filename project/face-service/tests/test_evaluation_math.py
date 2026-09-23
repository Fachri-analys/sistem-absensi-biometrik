"""
Unit test untuk matematika metrik evaluasi face matching (TP, TN, FP, FN, Precision, Recall, F1, FAR, FRR, EER).
Menggunakan data sintetis tanpa membutuhkan GPU atau file gambar eksternal.
"""

import unittest
import numpy as np

from scripts.evaluate_matching import (
    calculate_metrics,
    sweep_thresholds,
    find_optimal_thresholds,
    generate_pairwise_scores,
    generate_gallery_probe_scores,
)
from app.face_engine import FaceEngine


class TestEvaluationMath(unittest.TestCase):
    def test_calculate_metrics_perfect_separation(self):
        """
        Uji kasus ideal di mana skor genuine dan impostor terpisah sempurna.
        Genuine: [0.60, 0.70, 0.80, 0.90] (4 sampel)
        Impostor: [0.10, 0.20, 0.25, 0.30] (4 sampel)
        Threshold: 0.40 -> TP=4, FN=0, FP=0, TN=4
        """
        genuine = [0.60, 0.70, 0.80, 0.90]
        impostor = [0.10, 0.20, 0.25, 0.30]
        m = calculate_metrics(genuine, impostor, threshold=0.40)

        self.assertEqual(m.tp, 4)
        self.assertEqual(m.fn, 0)
        self.assertEqual(m.fp, 0)
        self.assertEqual(m.tn, 4)
        self.assertEqual(m.precision, 1.0)
        self.assertEqual(m.recall, 1.0)
        self.assertEqual(m.f1_score, 1.0)
        self.assertEqual(m.far, 0.0)
        self.assertEqual(m.frr, 0.0)

    def test_calculate_metrics_with_errors(self):
        """
        Uji kasus realistis dengan overlap antara genuine dan impostor.
        Genuine: [0.30, 0.45, 0.55, 0.70] (4 sampel)
        Impostor: [0.15, 0.25, 0.35, 0.50] (4 sampel)
        Threshold: 0.40:
          - genuine >= 0.40: 0.45, 0.55, 0.70 -> TP=3
          - genuine < 0.40: 0.30 -> FN=1
          - impostor >= 0.40: 0.50 -> FP=1
          - impostor < 0.40: 0.15, 0.25, 0.35 -> TN=3
        """
        genuine = [0.30, 0.45, 0.55, 0.70]
        impostor = [0.15, 0.25, 0.35, 0.50]
        m = calculate_metrics(genuine, impostor, threshold=0.40)

        self.assertEqual(m.tp, 3)
        self.assertEqual(m.fn, 1)
        self.assertEqual(m.fp, 1)
        self.assertEqual(m.tn, 3)

        # Precision = TP / (TP + FP) = 3 / 4 = 0.75
        self.assertAlmostEqual(m.precision, 0.75, places=4)
        # Recall = TP / (TP + FN) = 3 / 4 = 0.75
        self.assertAlmostEqual(m.recall, 0.75, places=4)
        # F1 = 2 * (0.75 * 0.75) / (0.75 + 0.75) = 0.75
        self.assertAlmostEqual(m.f1_score, 0.75, places=4)
        # FAR = FP / (FP + TN) = 1 / 4 = 0.25
        self.assertAlmostEqual(m.far, 0.25, places=4)
        # FRR = FN / (TP + FN) = 1 / 4 = 0.25
        self.assertAlmostEqual(m.frr, 0.25, places=4)

    def test_sweep_thresholds_monotonicity(self):
        """
        Verifikasi sifat monotonik sweep:
        Saat threshold naik:
        - TP harus monotonik tidak naik (menurun atau tetap)
        - FP harus monotonik tidak naik (menurun atau tetap)
        - FN harus monotonik tidak turun (naik atau tetap)
        - TN harus monotonik tidak turun (naik atau tetap)
        """
        genuine = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75]
        impostor = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55]

        results = sweep_thresholds(genuine, impostor, min_threshold=0.10, max_threshold=0.80, step=0.10)
        self.assertGreater(len(results), 5)

        for i in range(len(results) - 1):
            curr = results[i]
            nxt = results[i + 1]
            self.assertGreaterEqual(curr.tp, nxt.tp)
            self.assertGreaterEqual(curr.fp, nxt.fp)
            self.assertLessEqual(curr.fn, nxt.fn)
            self.assertLessEqual(curr.tn, nxt.tn)

    def test_find_optimal_thresholds(self):
        """
        Uji pencarian EER, Best F1, dan High Security threshold.
        """
        genuine = [0.40, 0.50, 0.60, 0.70, 0.80]
        impostor = [0.10, 0.20, 0.30, 0.40, 0.50]

        results = sweep_thresholds(genuine, impostor, min_threshold=0.20, max_threshold=0.70, step=0.05)
        optimal = find_optimal_thresholds(results)

        self.assertIn("eer_threshold", optimal)
        self.assertIn("max_f1_threshold", optimal)
        self.assertIn("high_security_threshold", optimal)

        # Di threshold 0.45:
        # genuine >= 0.45: [0.50, 0.60, 0.70, 0.80] -> TP=4, FN=1 (FRR = 1/5 = 0.2)
        # impostor >= 0.45: [0.50] -> FP=1, TN=4 (FAR = 1/5 = 0.2)
        # FAR == FRR -> EER ada di sekitar 0.45
        self.assertAlmostEqual(optimal["eer_threshold"]["threshold"], 0.45, delta=0.06)

    def test_generate_pairwise_scores(self):
        """
        Uji perhitungan pairwise scores dengan vektor embedding buatan.
        """
        # Buat 2 siswa, masing-masing 2 foto (512 dimensi)
        v1 = np.ones(512, dtype=np.float32)
        v1 = v1 / np.linalg.norm(v1)

        v2 = np.ones(512, dtype=np.float32)
        v2[0] += 0.01
        v2 = v2 / np.linalg.norm(v2)

        v3 = -np.ones(512, dtype=np.float32)
        v3 = v3 / np.linalg.norm(v3)

        v4 = -np.ones(512, dtype=np.float32)
        v4[0] += 0.01
        v4 = v4 / np.linalg.norm(v4)

        data = {
            "student_001": [v1, v2],
            "student_002": [v3, v4],
        }

        genuine, impostor = generate_pairwise_scores(data, clamp=True)
        # 1 genuine pair dari student_001 (v1, v2) + 1 dari student_002 (v3, v4) = 2 genuine pairs
        self.assertEqual(len(genuine), 2)
        # Impostor: 2 * 2 = 4 impostor pairs
        self.assertEqual(len(impostor), 4)

        # Genuine score harus mendekati 1.0
        for s in genuine:
            self.assertGreater(s, 0.95)
        # Impostor score (v1/v2 vs v3/v4) bernilai negatif, clamped ke 0.0
        for s in impostor:
            self.assertEqual(s, 0.0)

    def test_generate_gallery_probe_scores(self):
        """
        Uji mode multi-sample gallery-probe.
        """
        rng = np.random.RandomState(42)
        base1 = rng.randn(512).astype(np.float32)
        base1 = base1 / np.linalg.norm(base1)

        base2 = rng.randn(512).astype(np.float32)
        base2 = base2 / np.linalg.norm(base2)

        # Siswa 1 punya 3 foto: 2 gallery, 1 probe
        s1_g1 = base1
        s1_g2 = (base1 + rng.randn(512) * 0.01).astype(np.float32)
        s1_g2 /= np.linalg.norm(s1_g2)
        s1_probe = (base1 + rng.randn(512) * 0.01).astype(np.float32)
        s1_probe /= np.linalg.norm(s1_probe)

        # Siswa 2 punya 3 foto: 2 gallery, 1 probe
        s2_g1 = base2
        s2_g2 = (base2 + rng.randn(512) * 0.01).astype(np.float32)
        s2_g2 /= np.linalg.norm(s2_g2)
        s2_probe = (base2 + rng.randn(512) * 0.01).astype(np.float32)
        s2_probe /= np.linalg.norm(s2_probe)

        data = {
            "student_001": [s1_g1, s1_g2, s1_probe],
            "student_002": [s2_g1, s2_g2, s2_probe],
        }

        genuine, impostor = generate_gallery_probe_scores(data, gallery_size=2)
        # 1 probe per siswa -> 2 genuine scores
        self.assertEqual(len(genuine), 2)
        # 1 probe s1 vs s2 gallery (1 score max), 1 probe s2 vs s1 gallery (1 score max) -> 2 impostor scores
        self.assertEqual(len(impostor), 2)

        for s in genuine:
            self.assertGreater(s, 0.90)
        for s in impostor:
            self.assertLess(s, 0.30)


class TestNormalizationAndCosineSimilarity(unittest.TestCase):
    def test_safe_l2_normalize_zero_vector(self):
        """Vektor bernilai nol tidak boleh menyebabkan ZeroDivisionError atau NaN."""
        zero_vec = np.zeros(512, dtype=np.float32)
        normed = FaceEngine.safe_l2_normalize(zero_vec)
        self.assertEqual(normed.shape, (512,))
        self.assertFalse(np.isnan(normed).any())
        self.assertEqual(float(np.linalg.norm(normed)), 0.0)

    def test_safe_l2_normalize_unit_length(self):
        """Vektor normal harus dinormalkan ke panjang 1.0."""
        vec = np.array([3.0, 4.0], dtype=np.float32)
        normed = FaceEngine.safe_l2_normalize(vec)
        np.testing.assert_array_almost_equal(normed, [0.6, 0.8], decimal=5)
        self.assertAlmostEqual(float(np.linalg.norm(normed)), 1.0, places=5)

    def test_cosine_similarity_clamp_behavior(self):
        """Uji perilaku clamp=True (produksi) vs clamp=False (evaluasi)."""
        vec_a = [1.0, 0.0]
        vec_b = [-1.0, 0.0]  # Berlawanan arah: cosine = -1.0

        clamped = FaceEngine.cosine_similarity(vec_a, vec_b, clamp=True)
        self.assertEqual(clamped, 0.0)

        unclamped = FaceEngine.cosine_similarity(vec_a, vec_b, clamp=False)
        self.assertAlmostEqual(unclamped, -1.0, places=5)


if __name__ == "__main__":
    unittest.main()
