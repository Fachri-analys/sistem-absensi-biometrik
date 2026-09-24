# Aplikasi Sistem Absensi

Folder ini berisi APP Next.js, worker BullMQ, schema Prisma, test, dan
microservice Python di [`face-service/`](face-service/README.md).

## 1. Prasyarat

- Node.js 20 atau lebih baru
- npm
- Python 3.11 atau lebih baru untuk Face Service
- Docker Desktop + Docker Compose untuk PostgreSQL, Redis, dan integration test
- Git

## 2. Clone dan masuk ke folder aplikasi

```bash
git clone https://github.com/Fachri-analys/sistem-absensi-biometrik.git
cd sistem-absensi-biometrik/project
```

## 3. Siapkan environment

Salin template berikut, lalu isi nilainya. Jangan commit file `.env`.

```bash
# macOS/Linux/Git Bash
cp .env.example .env

# PowerShell
Copy-Item .env.example .env
```

Minimal untuk development:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `SESSION_SECRET`
- `CAMERA_API_KEY_SALT`
- `FACE_SERVICE_API_KEY`
- `FACE_SERVICE_URL`

`FACE_SERVICE_API_KEY` harus sama persis dengan
`INTERNAL_SERVICE_KEY` di `face-service/.env`. Gunakan secret acak, bukan
nilai contoh. Object Storage diperlukan untuk fitur yang menyimpan foto
enrolment sementara atau laporan; lihat komentar di `.env.example`.

Untuk presensi multi-frame, `NEXT_PUBLIC_CHECKIN_FRAME_COUNT` mengatur jumlah
frame yang diambil browser dan `CHECKIN_MIN_CONSISTENT_FRAMES` mengatur quorum
identity+liveness. Keduanya dapat diubah lewat environment tanpa mengubah
source code; nilai pertama harus minimal sama dengan nilai kedua.

## 4. Jalankan dependency lokal

Dari folder `project/`:

```bash
docker compose up -d postgres redis
```

Periksa statusnya:

```bash
docker compose ps
```

## 5. Install dependency dan siapkan database

```bash
npm ci
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

Seeder membuat role, jadwal default, dan akun `SUPER_ADMIN`. Password awal
ditampilkan satu kali di terminal; simpan secara aman dan ganti setelah login.
Jika database benar-benar baru dan belum ada migration, gunakan
`npx prisma migrate dev --name init`.

## 6. Jalankan Face Service

Buka terminal kedua:

```bash
cd project/face-service

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
cp .env.example .env

# Windows PowerShell (gunakan ini sebagai pengganti blok di atas)
python -m venv venv
.\venv\Scripts\Activate.ps1
Copy-Item .env.example .env

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Isi `INTERNAL_SERVICE_KEY` dan `EMBEDDING_ENCRYPTION_KEY` di
`face-service/.env`, lalu pasang model YOLO face dan model liveness sesuai
[`face-service/models/README.md`](face-service/models/README.md).
Verifikasi:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

Tanpa Face Service, endpoint check-in utama akan gagal. Tanpa model liveness,
service sengaja fail-closed dan menolak request.

## 7. Jalankan APP dan Worker

Buka terminal ketiga untuk APP:

```bash
cd project
npm run dev
```

APP tersedia di <http://localhost:3000>. Buka terminal keempat untuk worker:

```bash
cd project
npm run worker
```

Alternatifnya, jalankan APP dan worker melalui Docker Compose setelah `.env`
siap:

```bash
docker compose up -d --build app worker
```

Migration tetap dijalankan manual dengan `npx prisma migrate deploy` sebelum
stack container digunakan.

## 8. Perintah pengembangan

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan Next.js dalam mode development |
| `npm run worker` | Menjalankan BullMQ worker |
| `npm run typecheck` | Memeriksa tipe TypeScript |
| `npm run lint` | Menjalankan ESLint |
| `npm run test:unit` | Menjalankan unit test tanpa Docker |
| `npm run test:integration` | Menjalankan integration test dengan Testcontainers |
| `npm run test:watch` | Menjalankan Vitest watch mode |
| `npm run prisma:studio` | Membuka Prisma Studio |
| `npm run build` | Memastikan build production berhasil |

Sebelum push, jalankan:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Integration test membutuhkan Docker aktif:

```bash
npm run test:integration
```

## 9. Alur pengembangan fitur

1. Baca issue dan dokumentasi yang terkait.
2. Buat branch:
   ```bash
   git switch -c feat/nama-fitur
   ```
3. Implementasikan perubahan dengan mengikuti pola route, service, dan
   validasi yang sudah ada.
4. Jika mengubah database, edit `prisma/schema.prisma`, buat migration dengan
   `npx prisma migrate dev --name deskripsi-perubahan`, dan uji seeder.
5. Jika mengubah API, perbarui kontrak di [`../docs/05-API-SPEC.md`](../docs/05-API-SPEC.md)
   serta test yang relevan.
6. Jika mengubah biometrik, jangan menyimpan foto check-in atau embedding
   mentah; baca [`../docs/06-SECURITY-SPEC.md`](../docs/06-SECURITY-SPEC.md).
7. Jalankan pemeriksaan pada bagian 8.
8. Push branch dan buat pull request ke `main`:
   ```bash
   git push -u origin feat/nama-fitur
   ```

## 10. Struktur kode

```text
src/app/api/       Route handler API Next.js
src/app/           Halaman UI dan layout
src/lib/           Auth, Prisma, cache, queue, dan integrasi face service
worker/             Proses BullMQ terpisah
prisma/             Schema, migration, dan seed
tests/integration/  Test dengan dependency nyata
face-service/       API Python untuk biometrik
```

## 11. Troubleshooting cepat

- **Database tidak tersambung:** pastikan `docker compose ps` menunjukkan
  `postgres` sehat dan `DATABASE_URL` sesuai mode menjalankan aplikasi.
- **Redis gagal tersambung:** periksa `REDIS_PASSWORD` dan `REDIS_URL`.
- **Check-in selalu gagal:** pastikan Face Service hidup, API key sama, dan
  `/ready` menunjukkan model liveness tersedia.
- **Migration gagal:** jangan menghapus volume database sembarangan. Periksa
  migration yang belum diterapkan dengan `npx prisma migrate status`.
- **Port bentrok:** ubah port host pada Docker Compose atau hentikan proses
  yang menggunakan port 3000/8000.

## 12. Dokumentasi lanjutan

Mulai dari [`../docs/README.md`](../docs/README.md). Dokumen keamanan wajib
dibaca sebelum menyentuh autentikasi, data pribadi, foto, embedding, atau
endpoint check-in.
