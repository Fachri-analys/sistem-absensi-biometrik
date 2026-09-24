"""
Konfigurasi face-service, semua dari environment variable — tidak ada
secret/kredensial hardcoded di kode (docs/06-SECURITY-SPEC.md §Secret Management).
"""

try:
    from pydantic_settings import BaseSettings
except ImportError:  # pragma: no cover
    import os

    class BaseSettings:  # type: ignore
        def __init__(self, **kwargs):
            for key, val in kwargs.items():
                setattr(self, key, val)
            for attr in dir(self.__class__):
                if not attr.startswith("_") and attr != "Config":
                    env_val = os.environ.get(attr.upper())
                    if env_val is not None:
                        orig = getattr(self.__class__, attr)
                        if isinstance(orig, float):
                            setattr(self, attr, float(env_val))
                        elif isinstance(orig, int):
                            setattr(self, attr, int(env_val))
                        else:
                            setattr(self, attr, env_val)


class Settings(BaseSettings):

    # Shared secret antara Next.js APP dan service ini — service ini TIDAK
    # PERNAH diekspos ke internet publik/siswa, hanya dipanggil server-ke-
    # server dari APP. Header X-Internal-Service-Key wajib cocok.
    internal_service_key: str = "dev-internal-service-key-placeholder-32chars"
    embedding_encryption_key: str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

    # Path model liveness (ONNX). Lihat models/README.md untuk cara
    # mendapatkan file model yang kompatibel — TIDAK di-bundle di repo ini
    # karena file model biner sebaiknya diverifikasi/didownload sendiri oleh
    # deployer, bukan diikutsertakan mentah-mentah di kode sumber.
    liveness_model_path: str = "./models/minifasnet.onnx"
    liveness_input_size: int = 80  # harus cocok dengan dimensi input ONNX
    # Kontrak preprocessing model. Default cocok dengan upstream
    # 2.7_80x80_MiniFASNetV2 (BGR, 3 kelas, class 1 = live).
    liveness_input_color_order: str = "BGR"
    liveness_crop_scale: float = 2.7
    # Tidak semua varian MiniFASNet memiliki urutan kelas yang sama. Wajib
    # diisi eksplisit agar service tidak menebak dan menukar live/spoof.
    # Upstream 3-kelas biasanya 1; model 2-kelas custom harus mengikuti
    # label model (contoh umum: 0 = real/live).
    liveness_expected_class_count: int = 3
    liveness_live_class_index: int | None = None
    liveness_threshold: float = 0.5

    # InsightFace: nama model buffalo_l otomatis download ke ~/.insightface
    # saat pertama kali dipakai (lihat docs/README.md face-service).
    insightface_model_name: str = "buffalo_l"

    # YOLO face detector. Weight ONNX wajib diprovision oleh deployment dan
    # tidak boleh didownload diam-diam saat request pertama.
    yolo_face_model_path: str = "./models/yolo-face.onnx"
    yolo_input_size: int = 640
    yolo_confidence_threshold: float = 0.50
    yolo_iou_threshold: float = 0.45
    yolo_face_class_id: int | None = 0
    yolo_class_count: int = 1
    yolo_has_objectness: bool = False
    yolo_normalized_output: bool = False
    yolo_box_format: str = "cxcywh"
    yolo_max_detections: int = 20
    yolo_embedding_iou_threshold: float = 0.20

    # Threshold kecocokan cosine similarity raw (ArcFace standard ~0.40)
    # Dapat dikonfigurasi melalui MATCH_THRESHOLD atau MATCH_THRESHOLD_DEFAULT di .env
    match_threshold: float = 0.40
    match_threshold_default: float = 0.40  # backward compatibility alias

    # Threshold validasi kualitas foto (Face Quality Check)
    # Dapat dikonfigurasi melalui environment variable tanpa hardcoding angka di banyak file.
    min_image_width: int = 200
    min_image_height: int = 200
    blur_threshold: float = 80.0
    min_brightness: float = 40.0
    max_brightness: float = 220.0
    min_face_size: int = 80
    crop_margin_px: int = 5
    max_yaw: float = 30.0
    max_pitch: float = 30.0
    max_roll: float = 30.0
    max_yaw_ratio: float = 0.60

    class Config:
        env_file = ".env"


settings = Settings()

