import unittest

import cv2
import numpy as np

from app.face_engine import FaceEngine
from app.yolo_face_detector import YoloDetection, YoloDetectorNotReadyError, YoloFaceDetector


class FakeInput:
    name = "images"


class FakeSession:
    def __init__(self, output):
        self.output = output
        self.input = None

    def get_inputs(self):
        return [FakeInput()]

    def run(self, _output_names, inputs):
        self.input = inputs["images"]
        return [self.output]


def make_textured_image(width=300, height=200):
    image = np.full((height, width, 3), 128, dtype=np.uint8)
    for y in range(0, height, 10):
        for x in range(0, width, 10):
            image[y : y + 10, x : x + 10] = 170 if (x // 10 + y // 10) % 2 == 0 else 90
    return image


class TestYoloFaceDetector(unittest.TestCase):
    def test_missing_model_fails_closed(self):
        detector = YoloFaceDetector(model_path="definitely-missing-yolo-face.onnx")

        self.assertFalse(detector.is_ready)
        with self.assertRaises(YoloDetectorNotReadyError):
            detector.detect(make_textured_image())

    def test_preprocess_converts_bgr_camera_input_to_rgb_tensor(self):
        image = np.zeros((4, 4, 3), dtype=np.uint8)
        image[:, :] = (10, 20, 30)  # BGR
        session = FakeSession(np.array([[[2.0], [2.0], [4.0], [4.0], [0.95]]], dtype=np.float32))
        detector = YoloFaceDetector(model_path="unused.onnx", session=session, input_size=4)

        detector.detect(image)

        np.testing.assert_allclose(session.input[0, :, 0, 0], [30 / 255, 20 / 255, 10 / 255], rtol=0, atol=1e-6)

    def test_preprocess_is_nchw_and_decodes_letterboxed_box(self):
        # Image 300x200 is letterboxed to 640x640. The box below maps back
        # to approximately (50, 25, 250, 175) in the source image.
        output = np.array([[[320.0], [320.0], [426.6667], [320.0], [0.95]]], dtype=np.float32)
        session = FakeSession(output)
        detector = YoloFaceDetector(model_path="unused.onnx", session=session, input_size=640)

        detections = detector.detect(make_textured_image())

        self.assertEqual(len(detections), 1)
        self.assertAlmostEqual(detections[0].bbox[0], 50.0, delta=1.0)
        self.assertAlmostEqual(detections[0].bbox[1], 25.0, delta=1.0)
        self.assertAlmostEqual(detections[0].bbox[2], 250.0, delta=1.0)
        self.assertAlmostEqual(detections[0].bbox[3], 175.0, delta=1.0)
        self.assertEqual(session.input.shape, (1, 3, 640, 640))
        self.assertEqual(session.input.dtype, np.float32)
        self.assertGreaterEqual(float(session.input.min()), 0.0)
        self.assertLessEqual(float(session.input.max()), 1.0)

    def test_filters_class_and_applies_nms(self):
        # Three rows: two overlapping face boxes and one non-face class.
        output = np.array(
            [
                [320.0, 320.0, 300.0, 300.0, 0.90, 0.0],
                [322.0, 322.0, 300.0, 300.0, 0.80, 0.0],
                [100.0, 100.0, 50.0, 50.0, 0.99, 1.0],
            ],
            dtype=np.float32,
        )
        detector = YoloFaceDetector(
            model_path="unused.onnx",
            session=FakeSession(output),
            input_size=640,
            class_count=2,
            face_class_id=0,
            iou_threshold=0.5,
        )

        detections = detector.detect(make_textured_image())

        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].class_id, 0)
        self.assertAlmostEqual(detections[0].confidence, 0.90, places=5)

    def test_face_engine_uses_yolo_as_primary_gate(self):
        class MockFace:
            bbox = np.array((50, 25, 250, 175), dtype=np.float32)
            pose = np.array((0.0, 0.0, 0.0), dtype=np.float32)
            kps = np.array(
                [[80, 65], [220, 65], [150, 100], [90, 145], [210, 145]],
                dtype=np.float32,
            )
            normed_embedding = np.ones(512, dtype=np.float32) / np.sqrt(512)

        class MockInsightFace:
            def get(self, _image):
                return [MockFace()]

        class MockYolo:
            is_ready = True

            def detect(self, _image):
                return [YoloDetection((50.0, 25.0, 250.0, 175.0), 0.95, 0)]

        image = make_textured_image()
        _, encoded = cv2.imencode(".jpg", image)
        engine = FaceEngine(app=MockInsightFace(), detector=MockYolo())

        detected, quality = engine.extract_face_with_quality(encoded.tobytes())

        self.assertTrue(quality.is_valid)
        self.assertIsNotNone(detected)
        self.assertEqual(detected.bbox, (50.0, 25.0, 250.0, 175.0))


if __name__ == "__main__":
    unittest.main()
