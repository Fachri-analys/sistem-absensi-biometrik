# face-service — jalan di Linux biasa, TIDAK butuh Windows/GPU (InsightFace +
# ONNX Runtime CPU sudah diverifikasi jalan saat pengembangan). Cocok
# dipasang di salah satu dari dua server yang tersedia, terpisah dari APP
# Next.js (docs/03-SAD.md pola yang sama: service terpisah, dipanggil via
# HTTP internal).

FROM python:3.11-slim

# Dependency sistem untuk OpenCV headless.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY models ./models

# PERBAIKAN: useradd -m (bukan --system tanpa home) agar InsightFace bisa
# menulis cache model ke ~/.insightface/. Tanpa home directory, InsightFace
# crash dengan PermissionError saat mencoba akses /root/.insightface.
RUN useradd -m --uid 1001 faceservice

# Set environment agar InsightFace tahu di mana menyimpan model cache.
ENV HOME=/home/faceservice
ENV INSIGHTFACE_HOME=/home/faceservice/.insightface

# Pre-create cache directory dan set ownership.
RUN mkdir -p /home/faceservice/.insightface && \
    chown -R faceservice:faceservice /app /home/faceservice

USER faceservice

# Model InsightFace didownload otomatis saat startup pertama (butuh akses
# internet keluar sekali saja, lalu di-cache) — pertimbangkan menjalankan
# `python -c "from app.face_engine import face_engine"` sekali saat build
# image (bukan saat container start) kalau ingin startup produksi lebih
# cepat/tidak butuh internet saat runtime. Belum dilakukan di Dockerfile ini
# supaya build tidak gagal di lingkungan tanpa akses internet saat build.

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
