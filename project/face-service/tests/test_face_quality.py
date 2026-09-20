import unittest
import numpy as np
import cv2

from app.config import settings
from app.face_engine import FaceEngine, QualityResult, DetectedFace


class MockFace:
    def __init__(self, bbox=(50, 50, 250, 250), pose=(0.0, 0.0, 0.0), kps=None, embedding=None):
        self.bbox = np.array(bbox, dtype=np.float32)
        self.pose = np.array(pose, dtype=np.float32) if pose is not None else None
        if kps is not None:
            self.kps = np.array(kps, dtype=np.float32)
        else:
            # Default symmetrical 5 landmarks inside bbox
            x1, y1, x2, y2 = bbox
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2
            self.kps = np.array([
                [x1 + 30, y1 + 40],   # left eye
                [x2 - 30, y1 + 40],   # right eye
                [mid_x, mid_y],       # nose
                [x1 + 40, y2 - 30],   # left mouth
                [x2 - 40, y2 - 30],   # right mouth
            ], dtype=np.float32)

        if embedding is not None:
            self.normed_embedding = np.array(embedding, dtype=np.float32)
        else:
            emb = np.random.randn(512).astype(np.float32)
            self.normed_embedding = emb / np.linalg.norm(emb)


class MockFaceAnalysisApp:
    def __init__(self, return_faces=None):
        self.return_faces = return_faces if return_faces is not None else []

    def get(self, img):
        return self.return_faces


def make_test_image(width=300, height=300, brightness=128, add_texture=True):
    """Helper membuat image bytes JPEG yang valid dengan parameter terkontrol."""
    img = np.full((height, width, 3), brightness, dtype=np.uint8)
    if add_texture:
        for i in range(0, height, 10):
            for j in range(0, width, 10):
                if (i // 10 + j // 10) % 2 == 0:
                    img[i:i+10, j:j+10] = min(255, brightness + 40)
                else:
                    img[i:i+10, j:j+10] = max(0, brightness - 40)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


class TestFaceQualityPipeline(unittest.TestCase):

    def test_invalid_image_corrupt_or_empty(self):
        engine = FaceEngine(app=MockFaceAnalysisApp())
        res1 = engine.check_quality(b"")
        self.assertFalse(res1.is_valid)
        self.assertEqual(res1.reason, "invalid_image")

        res2 = engine.check_quality(b"not an image data")
        self.assertFalse(res2.is_valid)
        self.assertEqual(res2.reason, "invalid_image")

    def test_invalid_image_low_resolution(self):
        engine = FaceEngine(app=MockFaceAnalysisApp())
        # settings.min_image_width = 200, settings.min_image_height = 200
        low_res_bytes = make_test_image(width=150, height=150)
        res = engine.check_quality(low_res_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "invalid_image")

    def test_image_too_blurry(self):
        engine = FaceEngine(app=MockFaceAnalysisApp())
        flat_bytes = make_test_image(width=300, height=300, add_texture=False)
        res = engine.check_quality(flat_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "image_too_blurry")

    def test_poor_lighting_too_dark(self):
        engine = FaceEngine(app=MockFaceAnalysisApp())
        # settings.min_brightness = 40.0
        dark_bytes = make_test_image(width=300, height=300, brightness=20, add_texture=True)
        res = engine.check_quality(dark_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "poor_lighting")

    def test_poor_lighting_too_bright(self):
        engine = FaceEngine(app=MockFaceAnalysisApp())
        # settings.max_brightness = 220.0
        bright_bytes = make_test_image(width=300, height=300, brightness=240, add_texture=True)
        res = engine.check_quality(bright_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "poor_lighting")

    def test_no_face_detected(self):
        mock_app = MockFaceAnalysisApp(return_faces=[])
        engine = FaceEngine(app=mock_app)
        img_bytes = make_test_image(width=300, height=300, brightness=128, add_texture=True)
        res = engine.check_quality(img_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "no_face")

    def test_multiple_faces_detected(self):
        face1 = MockFace(bbox=(50, 50, 150, 150))
        face2 = MockFace(bbox=(160, 50, 260, 150))
        mock_app = MockFaceAnalysisApp(return_faces=[face1, face2])
        engine = FaceEngine(app=mock_app)
        img_bytes = make_test_image(width=300, height=300, brightness=128, add_texture=True)
        res = engine.check_quality(img_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "multiple_faces")

    def test_face_too_small(self):
        # settings.min_face_size = 80. bbox 50x50 is too small
        face = MockFace(bbox=(100, 100, 150, 150))  # w=50, h=50
        mock_app = MockFaceAnalysisApp(return_faces=[face])
        engine = FaceEngine(app=mock_app)
        img_bytes = make_test_image(width=300, height=300, brightness=128, add_texture=True)
        res = engine.check_quality(img_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "face_too_small")

    def test_face_cropped_at_border(self):
        # settings.crop_margin_px = 5. x1 <= 5
        face = MockFace(bbox=(2, 50, 200, 250))
        mock_app = MockFaceAnalysisApp(return_faces=[face])
        engine = FaceEngine(app=mock_app)
        img_bytes = make_test_image(width=300, height=300, brightness=128, add_texture=True)
        res = engine.check_quality(img_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "face_cropped")

    def test_extreme_pose_via_pose_degrees(self):
        # settings.max_yaw = 30.0. yaw = 45.0
        face = MockFace(bbox=(50, 50, 250, 250), pose=(0.0, 45.0, 0.0))
        mock_app = MockFaceAnalysisApp(return_faces=[face])
        engine = FaceEngine(app=mock_app)
        img_bytes = make_test_image(width=300, height=300, brightness=128, add_texture=True)
        res = engine.check_quality(img_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "extreme_pose")

    def test_extreme_pose_via_landmarks_roll(self):
        # Landmarks with extreme tilt (roll)
        tilted_kps = [
            [60, 60],    # left eye
            [160, 160],  # right eye (45 degree slope)
            [100, 120],  # nose
            [80, 180],
            [140, 200],
        ]
        face = MockFace(bbox=(50, 50, 250, 250), pose=None, kps=tilted_kps)
        mock_app = MockFaceAnalysisApp(return_faces=[face])
        engine = FaceEngine(app=mock_app)
        img_bytes = make_test_image(width=300, height=300, brightness=128, add_texture=True)
        res = engine.check_quality(img_bytes)
        self.assertFalse(res.is_valid)
        self.assertEqual(res.reason, "extreme_pose")

    def test_valid_face_passes_all_checks(self):
        face = MockFace(bbox=(50, 50, 250, 250), pose=(5.0, -5.0, 2.0))
        mock_app = MockFaceAnalysisApp(return_faces=[face])
        engine = FaceEngine(app=mock_app)
        img_bytes = make_test_image(width=300, height=300, brightness=128, add_texture=True)
        res = engine.check_quality(img_bytes)
        self.assertTrue(res.is_valid)
        self.assertIsNone(res.reason)

        detected = engine.detect_single_face(img_bytes)
        self.assertIsNotNone(detected)
        self.assertEqual(len(detected.embedding), 512)


if __name__ == "__main__":
    unittest.main()
