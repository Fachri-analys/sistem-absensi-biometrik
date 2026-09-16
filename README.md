# Sistem Absensi Biometrik Sekolah (Face Recognition 1:1)

Sistem presensi mandiri siswa berbasis biometrik wajah (1:1 Face Verification) terintegrasi anti-spoofing liveness detection, backend Next.js App Router, worker BullMQ (Redis), database PostgreSQL, dan microservice internal Python (InsightFace ArcFace + MiniFASNet ONNX).

---

## 📁 Struktur Repositori

```text
├── docs/                        # 17 Dokumen Spesifikasi Lengkap (PRD, SRS, SAD, ERD, API, Keamanan, dll.)
├── project/                     # Aplikasi Utama & Infrastruktur
│   ├── face-service/            # Microservice Python: InsightFace (ArcFace) + MiniFASNet (Anti-Spoofing)
│   ├── prisma/                  # Schema PostgreSQL, Relasi, Migrasi, dan Data Seeder
│   ├── src/                     # Next.js 14 (App Router REST API, Auth RBAC, SSE Realtime, Client Biometrik)
│   ├── worker/                  # BullMQ Background Workers (Enrollment Wajah, Rekap, PDF Export)
│   ├── tests/                   # Integration Tests (Testcontainers PostgreSQL race-condition test)
│   ├── docker-compose.yml       # Orkestrasi Docker (PostgreSQL, Redis, App, Worker)
│   └── next.config.js           # Konfigurasi Next.js & Header Keamanan (Permissions-Policy camera)
└── .gitignore                   # Ignore node_modules, cache Python, file model ONNX, dan .env
```

---

## ⚡ Status MVP Saat Ini (Telah Diperbaiki & Dioptimasi)

Pipeline deteksi wajah inti telah diperbaiki dari 8 bug kritis:
1. **Liveness Detection**: Menggunakan MiniFASNet ONNX dengan aktivasi `softmax` dan pemetaan kelas `[0: Spoof, 1: Real/Live]` yang benar (mencegah false spoof). Dilengkapi hot-reload runtime tanpa restart service.
2. **Kalkulasi Kemiripan Wajah (Cosine Similarity)**: Menggunakan raw cosine similarity ArcFace langsung yang dikalibrasi ke default threshold **`0.40`** (mengatasi bug penolakan 100% siswa).
3. **Izin Kamera**: Header browser `Permissions-Policy` disetel ke `camera=(self)` agar browser HP siswa diizinkan mengakses kamera.
4. **Keamanan Enkripsi**: Embedding biometrik dienkripsi AES-256-GCM oleh `face-service`. Raw vector dan foto capture presensi **tidak pernah disimpan ke disk/database (RAM only)**.
5. **Worker Re-enrollment**: BullMQ otomatis membersihkan job lama yang selesai/gagal sehingga re-enrollment siswa tidak lagi terhenti.

---

## 🚀 Panduan Langkah Selanjutnya (Next Steps Checklist)

Berikut adalah tahapan konkret berikutnya yang perlu dilakukan untuk membawa sistem ke tahap pengujian dan produksi:

### 1. Unduh Model Liveness ONNX
Letakkan file bobot model MiniFASNet ONNX ke folder `project/face-service/models/`:
- **File target**: `project/face-service/models/minifasnet.onnx`
- **Sumber Model**:
  - Pilihan A: [garciafido/minifasnet-v2-anti-spoofing-onnx](https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx) (Input: 80x80 BGR)
  - Pilihan B: [johnraivenolazo/face-antispoof-onnx](https://github.com/johnraivenolazo/face-antispoof-onnx)
- Panduan lengkap unduh ada di [`project/face-service/models/README.md`](project/face-service/models/README.md).

### 2. Setup Environment Variables
Buat file konfigurasi `.env` pada kedua direktori:
- **`project/.env`**:
  ```bash
  cd project
  cp .env.example .env
  # Isi POSTGRES_PASSWORD, REDIS_PASSWORD, SESSION_SECRET, CAMERA_API_KEY_SALT,
  # FACE_SERVICE_API_KEY (sama dengan INTERNAL_SERVICE_KEY di face-service),
  # dan OBJECT_STORAGE_* (MinIO/S3 untuk foto rapor enrollment & PDF).
  ```
- **`project/face-service/.env`**:
  ```bash
  cd project/face-service
  cp .env.example .env
  # Isi INTERNAL_SERVICE_KEY (sama dengan FACE_SERVICE_API_KEY)
  # Isi EMBEDDING_ENCRYPTION_KEY (generate: python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())")
  ```

### 3. Membangun UI Frontend Web Siswa & Admin Dashboard
Backend API Next.js App Router (`/api/...`) sudah lengkap dan siap digunakan. Langkah selanjutnya pada layer aplikasi web:
- **Halaman Presensi Siswa (`/checkin`)**:
  - Halaman antarmuka mobile-friendly di mana siswa memasukkan NISN dan membuka kamera web (`navigator.mediaDevices.getUserMedia`).
  - Mengirim payload `multipart/form-data` (`nisn` + `photo`) ke `POST /api/attendance/checkin`.
- **Halaman Admin / Operator**:
  - Dashboard statistik kehadiran hari ini (`/api/dashboard/stats`).
  - Layar monitor absensi realtime via Server-Sent Events (SSE: `/api/realtime/attendance`).
  - Manajemen Siswa & Upload Foto Rapor untuk Enrolment (`/api/students/[id]/biometric-enrollment`).

### 4. Menjalankan Layanan (Development / Container)
**Opsi Docker Compose (Direkomendasikan)**:
```bash
cd project
docker-compose up -d --build
```
Layanan akan menjalankan:
- PostgreSQL 16 (Port internal)
- Redis 7 (Port internal)
- Next.js Web Server (Port 3000)
- BullMQ Background Worker

**Menjalankan Face Service (Python)**:
```bash
cd project/face-service
python -m venv venv
# Windows: venv\Scripts\activate | Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 5. Inisialisasi Database & Seeder Awal
Jalankan migrasi schema dan buat akun `SUPER_ADMIN` serta jadwal masuk standar sekolah (07:00 WIB - 07:15 WIB):
```bash
cd project
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 6. Pengujian End-to-End & Kalibrasi Nilai Ambang (UAT)
1. **Daftarkan Wajah Siswa (Enrolment)**:
   - Unggah foto rapor siswa via `POST /api/students/:id/biometric-enrollment`.
2. **Coba Presensi HP (Check-in)**:
   - Ambil foto selfie siswa bersangkutan via `POST /api/attendance/checkin` bersama NISN.
   - Evaluasi skor kemiripan (`matchScore`). Nilai default `0.40` dapat disesuaikan per-kelas pada tabel `attendance_settings` jika ingin memperketat (misal `0.45` - `0.50`) sesuai kondisi pencahayaan di lapangan.
3. **Uji Anti-Spoofing**:
   - Uji coba menghadapkan foto cetak atau layar HP siswa ke kamera; pastikan liveness mendeteksi `passed: false`.

---

## 👥 Panduan Pengembangan Tim / Dev Kelompok

Untuk mempermudah kolaborasi dan pembagian tugas tim pengembang:

### 1. Rekomendasi Pembagian Tugas Anggota Kelompok
| Peran | Anggota | Fokus Tugas & File Kunci |
|---|---|---|
| **Frontend UI/UX** | Dev 1 | Menyempurnakan tampilan web mobile siswa (`src/app/checkin/`), dashboard admin (`src/app/dashboard/`), dan halaman login/auth (`src/app/auth/`). |
| **Backend & Database** | Dev 2 | Manajemen data master Siswa/Kelas/Jurusan (`src/app/api/students`, `classes`), sinkronisasi Dapodik/SIS (`docs/07-SYNC-SPEC.md`), dan migrasi Prisma (`prisma/schema.prisma`). |
| **AI & Biometrik** | Dev 3 | Download dan kalibrasi bobot model `minifasnet.onnx`, pengujian dataset foto wajah Indonesia, dan benchmark FPS/latensi inference (`project/face-service/`). |
| **DevOps & QA / Testing** | Dev 4 | Setup Docker Compose produksi, konfigurasi Redis & MinIO Object Storage, menjalankan integration test (`npm run test:integration`), dan CI/CD pipeline GitHub Actions. |

### 2. Panduan Setup Anggota Kelompok Baru
Anggota tim yang baru bergabung cukup menjalankan perintah berikut:
```bash
# 1. Clone repositori
git clone https://github.com/Fachri-analys/sistem-absensi-biometrik.git
cd sistem-absensi-biometrik

# 2. Setup environment
cd project
cp .env.example .env

# 3. Install & compile
npm install
npx prisma generate

# 4. Jalankan dev server
npm run dev
```

### 3. Aturan Workflow Git (Git Flow)
1. **Jangan push langsung ke `main`**. Buat branch fitur masing-masing:
   ```bash
   git checkout -b feat/nama-fitur-kamu
   ```
2. Sebelum commit, pastikan typecheck dan unit test lulus:
   ```bash
   npm run typecheck
   npm run test:unit
   ```
3. Push branch dan buat Pull Request (PR) ke `main`:
   ```bash
   git push origin feat/nama-fitur-kamu
   ```

