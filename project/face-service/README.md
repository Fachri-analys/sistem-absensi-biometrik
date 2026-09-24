# Face Service

Microservice Python internal untuk face detection (YOLO ONNX) dan face embedding (InsightFace buffalo_l)
dan liveness detection (MiniFASNet ONNX) — dipanggil oleh APP Next.js
(`src/lib/face-recognition.ts`, implementasi `HttpFaceRecognitionEngine`),
**tidak pernah diekspos langsung ke internet/siswa**.

Dipilih 100% open-source (tanpa lisensi berbayar) — lihat percakapan yang
membandingkan opsi ini dengan Recognito Vision (komersial, butuh Windows
Server) sebelum keputusan ini diambil.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# isi INTERNAL_SERVICE_KEY dan EMBEDDING_ENCRYPTION_KEY (lihat komentar di .env.example)

# WAJIB sebelum dipakai presensi sungguhan — lihat models/README.md
# (file model YOLO face dan liveness tidak di-bundle, harus dipasang terpisah)

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Model InsightFace (buffalo_l) otomatis terdownload ke `~/.insightface/` saat
pertama kali dijalankan (butuh koneksi internet sekali, lalu ter-cache). Model
YOLO face dan MiniFASNet tidak didownload saat runtime; keduanya wajib
dipasang dan diverifikasi oleh deployment.

## Verifikasi jalan dengan benar

```bash
curl http://localhost:8000/health          # {"status": "ok"}
curl http://localhost:8000/ready           # cek YOLO, InsightFace, dan liveness siap
```

## Alur presensi

Untuk jalur check-in HP, browser mengambil beberapa frame dari stream kamera
(jumlahnya diatur oleh `NEXT_PUBLIC_CHECKIN_FRAME_COUNT`). Server melakukan
quality filtering dan recognition per frame, lalu mensyaratkan identitas yang
cocok minimal `CHECKIN_MIN_CONSISTENT_FRAMES` kali sebelum menjalankan liveness
pada frame-frame tersebut. Endpoint frontend tetap sama; beberapa frame dikirim
sebagai beberapa field multipart `photo` dengan nama yang sama.

Presensi melewati tahap terpisah berikut di server:

```text
face detection
  → quality check
  → face recognition (embedding + 1:1 comparison)
  → liveness verification (MiniFASNet)
  → attendance
```

Liveness tidak mempercayai flag dari browser dan tidak diimplementasikan
sebagai mock yang selalu `true`. Jika model tidak ada, kontraknya salah, atau
inference gagal, hasilnya fail-closed (`passed: false`).

Attendance hanya dibuat setelah quorum identity dan liveness terpenuhi.
Constraint database `studentId + attendanceDate` menjadi pengaman terakhir
terhadap race condition dan duplicate attendance pada hari/sesi sekolah yang
sama.

## Yang SUDAH diverifikasi di repository

Tanpa weight model dan dataset nyata, yang dapat diverifikasi di lingkungan
ini adalah kontrak kode dan test terisolasi:
- preprocessing YOLO: BGR ke RGB, float32 NCHW, letterbox, dan koordinat box;
- confidence filtering, class mapping, dan NMS YOLO;
- YOLO sebagai primary gate sebelum embedding InsightFace;
- quality check, normalisasi embedding, mapping liveness, dan fail-closed;
- autentikasi shared-secret dan test frontend yang tersedia.

## Yang BELUM diverifikasi — WAJIB dicek sebelum produksi

- **YOLO face detection dan liveness detection (`/v1/liveness`) belum diuji
  dengan bobot model & foto
  asli di repository ini** — file bobot dan dataset pengujian tidak tersedia
  di lingkungan pengembangan.
  Lihat `models/README.md` untuk cara memasang dan mengujinya sendiri
  sebelum sistem ini dipakai siswa sungguhan. Tanpa model ini terpasang,
  endpoint akan menolak SEMUA request (fail-closed by design) — bukan
  diam-diam meloloskan.
- Akurasi InsightFace buffalo_l untuk populasi wajah siswa Indonesia secara
  spesifik belum dievaluasi — rekomendasi: uji dengan sampel foto rapor
  sungguhan sebelum rollout penuh, dan pertimbangkan periode percobaan
  dengan verifikasi manual operator sebagai jaring pengaman.

## Deployment

Lihat `Dockerfile` — jalan di Linux biasa (tidak butuh GPU/Windows). Cocok
dipasang di salah satu dari dua server yang tersedia, terpisah dari APP
Next.js yang di-hosting di cPanel.
