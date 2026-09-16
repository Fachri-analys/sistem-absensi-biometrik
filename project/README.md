# Sistem Absensi Biometrik Sekolah

Presensi siswa berbasis face recognition — siswa check-in mandiri dari HP
pribadi (ketik NISN, kamera aktif, foto dibandingkan dengan template dari
foto rapor). Dokumentasi arsitektur & keputusan produk lengkap ada di folder
`docs/` terpisah (PRD, SRS, SAD, ERD, dst) — file ini panduan teknis
menjalankan kode.

## Komponen

Ada **DUA** bagian kode yang berjalan sebagai proses terpisah:
1. **APP + Worker** (root project ini) — Next.js/TypeScript, mengelola data siswa/kelas/presensi/laporan, dashboard admin.
2. **`face-service/`** — Python, microservice terpisah untuk liveness detection + face embedding + perbandingan wajah. Dipanggil APP lewat HTTP internal, TIDAK PERNAH diakses langsung dari browser siswa. Lihat `face-service/README.md` — instruksi setup terpisah karena stack teknologinya berbeda (Python, bukan Node.js).

## Prasyarat

- Node.js ≥ 20 (APP + Worker)
- Python ≥ 3.11 (Face Service — lihat `face-service/README.md`)
- Docker + Docker Compose (untuk PostgreSQL, Redis, dan menjalankan stack penuh)

## Menjalankan untuk Development

```bash
cp .env.example .env
# isi .env — minimal: POSTGRES_PASSWORD, REDIS_PASSWORD, SESSION_SECRET,
# CAMERA_API_KEY_SALT, FACE_SERVICE_URL, FACE_SERVICE_API_KEY
# (generate secret dengan `openssl rand -base64 48`)

npm install
npx prisma generate
npx prisma migrate dev     # membuat schema di database
npm run db:seed            # roles, jadwal default, & akun SUPER_ADMIN pertama
                            # — password sementara ditampilkan SEKALI di console, catat!

npm run dev                # APP di http://localhost:3000
npm run worker             # di terminal terpisah — proses queue (attendance-processing, dst)
```

**Jalankan juga Face Service** (terminal terpisah lagi — lihat `face-service/README.md` untuk setup lengkap):
```bash
cd face-service
# setup venv, isi .env dengan FACE_SERVICE_API_KEY yang SAMA PERSIS dengan
# FACE_SERVICE_API_KEY di .env root project ini
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Tanpa Face Service berjalan, endpoint `POST /api/attendance/checkin` (jalur presensi UTAMA) akan gagal — ini bukan fitur opsional.

Postgres & Redis lokal bisa dijalankan cepat lewat:
```bash
docker-compose up postgres redis
```

## Menjalankan Stack Penuh via Docker

```bash
docker-compose up -d --build
```
Ini menjalankan APP, Worker, PostgreSQL, dan Redis (**belum termasuk
face-service** — jalankan terpisah via `face-service/Dockerfile`, karena di
topologi produksi nyata service ini memang ada di server fisik berbeda,
lihat `docs/15-INFRASTRUCTURE-SPEC.md` §5). Migration TIDAK dijalankan
otomatis oleh container; jalankan manual sebelum start pertama kali:

```bash
npx prisma migrate deploy
npm run db:seed
```

## Testing

```bash
npm run test:unit          # unit test murni, tanpa Docker/DB — cepat, jalankan setiap saat
npm run test:integration   # butuh Docker (Testcontainers spin up Postgres asli) — SUDAH ditulis, BELUM pernah lulus dijalankan (lingkungan pengembangan tidak punya Docker) — jalankan ini dulu sebelum percaya hasilnya
npm run typecheck          # tsc --noEmit
npm run lint
```

Unit test yang sudah ada (35 test, lulus) mencakup logic murni paling
kritis: perhitungan batas hari sekolah (WIB, bukan UTC — lihat
`src/lib/school-time.ts`, ini bug nyata yang pernah ditemukan & diperbaiki),
status ON_TIME/LATE, hashing API key kios, dan validasi input.

Integration test (`tests/integration/attendance-race-condition.test.ts`)
membuktikan — kalau lulus — bahwa constraint unique database benar-benar
mencegah duplikat presensi saat 20 request bersamaan untuk siswa yang sama
(skenario TC-ATT-003). **Jalankan ini sebelum go-live**, bukan cuma
mengandalkan kode terlihat benar.

Lihat
`docs/10-TEST-PLAN.md` §4 untuk status pengujian lengkap termasuk yang
BELUM dikerjakan (integration test, load test race condition, validasi
liveness dengan foto asli).

## Struktur Proyek

```
src/app/api/    Route handlers Next.js App Router (satu folder = satu endpoint)
src/lib/        Logic bersama: auth, prisma client, cache, queue, face-recognition, dsb.
worker/         Proses terpisah yang mengonsumsi BullMQ queue
prisma/         Schema database + seed script
face-service/   Microservice Python terpisah (liveness + embedding + similarity)
docker-compose.yml, Dockerfile, Dockerfile.worker   Deployment APP/Worker
```

## Sebelum Deploy ke Produksi

Baca `docs/11-DEPLOYMENT.md` §10 (topologi cPanel + Face Service dua-server)
dan `docs/12-OPERATIONS.md`. Pastikan juga:

- **`SEED_SUPER_ADMIN_EMAIL` & `SEED_SUPER_ADMIN_PASSWORD`** di-set eksplisit sebelum `npm run db:seed` di produksi.
- Seluruh `OBJECT_STORAGE_*` mengarah ke bucket produksi yang benar.
- **Model liveness detection di Face Service SUDAH dipasang dan DIUJI dengan foto asli** (lihat `face-service/models/README.md`) — tanpa ini, endpoint check-in menolak SEMUA presensi (fail-closed by design), tapi kalaupun model sudah dipasang, akurasi anti-spoof-nya BELUM dibuktikan di lingkungan pengembangan (tidak ada akses ke file bobot model saat kode ini ditulis) — WAJIB diuji sendiri sebelum dipakai siswa sungguhan.
- **`EMBEDDING_ENCRYPTION_KEY`** di Face Service sudah di-backup dengan aman — hilang berarti seluruh template biometrik siswa tidak bisa didekripsi lagi permanen.
- Jaringan antara server APP dan server Face Service sudah diamankan (TLS/VPN) — jangan kirim `X-Internal-Service-Key` atau foto siswa lewat HTTP polos di internet terbuka.
