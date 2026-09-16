"""
Konfigurasi face-service, semua dari environment variable — tidak ada
secret/kredensial hardcoded di kode (docs/06-SECURITY-SPEC.md §Secret Management).
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Shared secret antara Next.js APP dan service ini — service ini TIDAK
    # PERNAH diekspos ke internet publik/siswa, hanya dipanggil server-ke-
    # server dari APP. Header X-Internal-Service-Key wajib cocok.
    internal_service_key: str

    # Kunci AES-256 (32 byte, base64) untuk enkripsi embedding sebelum
    # dikembalikan sebagai embeddingRef ke APP. APP menyimpan string ini
    # apa adanya ke biometric_profiles.embedding_ref TANPA PERNAH bisa
    # mendekripsinya sendiri — hanya service ini yang punya kuncinya.
    # Generate dengan: python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
    embedding_encryption_key: str

    # Path model liveness (ONNX). Lihat models/README.md untuk cara
    # mendapatkan file model yang kompatibel — TIDAK di-bundle di repo ini
    # karena file model biner sebaiknya diverifikasi/didownload sendiri oleh
    # deployer, bukan diikutsertakan mentah-mentah di kode sumber.
    liveness_model_path: str = "./models/minifasnet.onnx"
    liveness_input_size: int = 80  # sesuaikan dengan model yang dipakai — lihat models/README.md

    # InsightFace: nama model buffalo_l otomatis download ke ~/.insightface
    # saat pertama kali dipakai (lihat docs/README.md face-service).
    insightface_model_name: str = "buffalo_l"

    # Threshold kecocokan cosine similarity raw (ArcFace standard ~0.40)
    match_threshold_default: float = 0.40  # NFR-ACC-001 — bisa dioverride per-request dari APP

    class Config:
        env_file = ".env"


settings = Settings()
