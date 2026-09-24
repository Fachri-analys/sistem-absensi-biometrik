# Face Service

Microservice Python internal untuk face embedding (InsightFace buffalo_l)
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
# (file model liveness tidak di-bundle, harus didownload terpisah)

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Model InsightFace (buffalo_l) otomatis terdownload ke `~/.insightface/` saat
pertama kali dijalankan (butuh koneksi internet sekali, lalu ter-cache).

## Verifikasi jalan dengan benar

```bash
curl http://localhost:8000/health          # {"status": "ok"}
curl http://localhost:8000/ready           # cek model liveness terpasang
```

## Alur presensi

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

## Yang SUDAH diverifikasi jalan (bukan sekadar ditulis)

Selama pengembangan, alur berikut diuji end-to-end dengan foto wajah asli
(bukan cuma dites secara teori):
- Deteksi wajah + validasi kualitas (`/v1/quality`)
- Generate embedding + enkripsi (`/v1/embedding`)
- Dekripsi + perbandingan cosine similarity (`/v1/compare`) — foto yang
  sama dengan dirinya sendiri menghasilkan similarity 1.0, sesuai ekspektasi
- Autentikasi shared-secret (401 tanpa header yang benar)

## Yang BELUM diverifikasi — WAJIB dicek sebelum produksi

- **Liveness detection (`/v1/liveness`) belum diuji dengan bobot model & foto
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
