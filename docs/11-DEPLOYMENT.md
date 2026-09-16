# 11 — Deployment Guide
## Sistem Absensi Biometrik Sekolah

---

## 1. Environments

| Environment | Tujuan |
|---|---|
| Development | Pengembangan lokal, database & Redis via Docker Compose, data dummy |
| Staging | Replika topologi produksi untuk QA, load test, UAT sekolah |
| Production | Layanan aktif untuk sekolah, akses dibatasi ketat |

## 2. Environment Variables (kategori, bukan nilai aktual)

- `DATABASE_URL` — koneksi PostgreSQL (secret).
- `REDIS_URL` — koneksi Redis (secret).
- `SESSION_SECRET` — kunci penandatanganan token (secret).
- `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET_*`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY` — konfigurasi S3-compatible (secret).
- `CAMERA_API_KEY_SALT` — untuk hashing API key kios/kamera opsional (secret).
- `FACE_SERVICE_URL`, `FACE_SERVICE_API_KEY` — alamat & shared-secret Face Service (secret; `FACE_SERVICE_API_KEY` HARUS SAMA PERSIS dengan `INTERNAL_SERVICE_KEY` di environment Face Service).
- `NODE_ENV`, `LOG_LEVEL` — konfigurasi umum (non-secret).
- `FACE_MATCH_THRESHOLD_DEFAULT` — nilai default ambang kecocokan (non-secret, dapat dioverride per kelas via `attendance_settings`).
- **Khusus Face Service** (environment terpisah dari APP): `INTERNAL_SERVICE_KEY`, `EMBEDDING_ENCRYPTION_KEY` (AES-256, **backup dengan sangat hati-hati** — hilang berarti seluruh template biometrik tidak bisa didekripsi permanen), `LIVENESS_MODEL_PATH`.

**Aturan wajib**: seluruh nilai secret di atas TIDAK PERNAH disimpan dalam repository (aturan #12) — dikelola via secret manager/CI-CD secret store per environment.

## 3. Docker

- Image terpisah untuk APP (Next.js) dan Worker (Node.js/TypeScript), dibangun dari Dockerfile masing-masing dengan multi-stage build (build stage terpisah dari runtime stage untuk ukuran image minimal).
- Base image resmi Node.js LTS, non-root user untuk menjalankan proses di dalam container.
- Health check container mengarah ke `GET /api/health` (APP) dan mekanisme setara untuk Worker (mis. proses masih hidup + koneksi queue aktif).

## 4. Database Migration

- Prisma Migrate digunakan untuk mengelola skema. Migrasi dijalankan sebagai langkah terpisah sebelum deployment APP versi baru (bukan otomatis saat container start di production, untuk menghindari race condition multi-instance menjalankan migrasi bersamaan).
- Migrasi bersifat backward-compatible sedapat mungkin (expand-then-contract pattern) agar instance lama dan baru dapat berjalan berdampingan selama rolling deployment.

## 5. Redis, Worker, Object Storage, CDN, Load Balancer, TLS

- Redis: instance terkelola atau self-hosted dengan autentikasi aktif, tidak diekspos ke internet publik.
- Worker: dideploy sebagai service terpisah dari APP, dapat di-scale independen berdasarkan panjang antrian.
- Object Storage: bucket per lingkungan (dev/staging/production terpisah) untuk mencegah campur data.
- CDN: mengarah ke asset statis build frontend, invalidasi cache dipicu saat deployment baru.
- Load Balancer: health check aktif ke `/api/ready` sebelum instance baru menerima trafik.
- TLS: sertifikat dikelola otomatis (mis. ACME) di titik terminasi TLS (CDN/Load Balancer), diperbarui sebelum kedaluwarsa.

## 6. Topologi Deployment: On-Premise Mini PC

Sekolah menyediakan satu unit mini PC sebagai host on-premise untuk seluruh stack (APP, Worker, PostgreSQL, Redis) via Docker Compose — bukan multi-server terpisah seperti diagram skala penuh di 03-SAD.md. Konsekuensinya:

- Mini PC ini adalah **single point of failure** secara fisik (bisa rusak, hilang, atau harus dimatikan saat renovasi/pindah lokasi). Karena itu, seluruh data (PostgreSQL, Object Storage lokal jika dipakai) TIDAK BOLEH hanya ada di satu perangkat ini — wajib ada salinan backup di lokasi terpisah (lihat §6 dan 12-OPERATIONS.md §Relocation Runbook).
- Seluruh service didefinisikan dalam satu `docker-compose.yml` + named volumes, agar environment dapat direplikasi persis di mesin lain jika mini PC ini rusak permanen — bukan hanya untuk migrasi terjadwal, tapi juga sebagai mitigasi darurat.
- Environment variables/secret disimpan terpisah dari volume data (mis. `.env` terenkripsi di luar volume Docker) sehingga proses restore ke perangkat baru tidak bergantung pada kondisi fisik mini PC lama.

## 7. Backup, Restore, Rollback

- Backup PostgreSQL terjadwal (lihat 12-OPERATIONS.md untuk frekuensi & retensi).
- **Wajib untuk topologi on-prem mini PC**: backup tidak boleh hanya disimpan di disk lokal mini PC yang sama — harus ada salinan terenkripsi di lokasi kedua (cloud storage terpisah, atau minimal drive eksternal yang disimpan di tempat berbeda dari mini PC) agar data tetap aman meski mini PC rusak/hilang saat proses pindah lokasi.
- Restore diuji berkala di environment staging (bukan hanya diasumsikan berhasil) — DAN diuji minimal sekali di mesin fisik berbeda dari mini PC produksi, untuk memvalidasi bahwa restore benar-benar portable, bukan hanya bekerja di mesin yang sama.
- Rollback aplikasi: image Docker versi sebelumnya tetap tersedia di registry untuk deployment mundur cepat; migrasi database yang destruktif harus memiliki rencana rollback eksplisit (mis. migrasi dua tahap) sebelum dieksekusi di production.

## 8. Relocation / Physical Migration Playbook (Mini PC)

Digunakan saat sekolah harus mematikan dan memindahkan mini PC sementara (renovasi/pindah lokasi):

1. **Sebelum mematikan**: jalankan backup penuh PostgreSQL (`pg_dump` atau snapshot volume) + backup Object Storage lokal (jika dipakai lokal, bukan cloud), verifikasi checksum backup, unggah/salin ke lokasi kedua yang terenkripsi (di luar mini PC).
2. **Catat state operasional**: versi image Docker yang berjalan, isi `.env`/konfigurasi (disimpan terpisah, bukan hanya di memori mini PC), status sinkronisasi terakhir (`sync_logs`).
3. **Graceful shutdown**: hentikan container secara berurutan (APP → Worker → Redis → PostgreSQL) agar tidak ada transaksi setengah jalan/korup saat mini PC dimatikan.
4. **Selama offline**: sistem presensi tidak beroperasi — ini adalah downtime yang direncanakan dan diterima (bukan insiden), dikomunikasikan ke sekolah sebelumnya. Backup di lokasi kedua adalah satu-satunya sumber data yang harus dijaga selama periode ini.
5. **Setelah dipindah & dinyalakan kembali**: jalankan `docker-compose up` di lokasi baru, restore volume dari backup jika volume asli tidak ikut terbawa/rusak, verifikasi integritas data (jumlah record kunci: students, classes, attendance terakhir sebelum shutdown harus cocok), jalankan health check (`/api/health`, `/api/ready`) sebelum sistem dianggap siap dipakai kembali.
6. **Verifikasi pasca-migrasi**: uji alur presensi end-to-end dengan minimal satu kamera sebelum mengumumkan sistem aktif kembali ke seluruh sekolah.

Checklist ini juga berlaku sebagai mitigasi darurat jika mini PC rusak permanen (bukan hanya skenario pindah terjadwal) — asal backup di lokasi kedua tersedia dan valid.

## 9. Zero/Minimal Downtime Deployment

- Rolling deployment: instance APP baru dinaikkan, health check lolos, baru instance lama diturunkan satu per satu (bukan seluruhnya sekaligus).
- Worker: consumer baru bergabung ke queue group sebelum consumer lama berhenti menerima job baru, menyelesaikan job berjalan sebelum shutdown (graceful shutdown).

## 10. Topologi cPanel + Face Service (Dua Server)

Lihat 15-INFRASTRUCTURE-SPEC.md §5 untuk detail lengkap. Ringkasan langkah deployment:

1. **Server Face Service** (Linux, Docker didukung): jalankan `face-service/Dockerfile`. Pasang model liveness sesuai `face-service/models/README.md` SEBELUM go-live (endpoint fail-closed tanpa model ini — lebih baik daripada diam-diam tanpa proteksi anti-spoof, tapi berarti presensi tidak akan berfungsi sampai model terpasang).
2. **Server cPanel** (APP): kalau paket cPanel mendukung "Setup Node.js App", deploy APP lewat situ. Kalau tidak (shared hosting murni tanpa Node.js), pertimbangkan menjalankan APP juga di Server 2 dan cPanel hanya untuk domain/DNS — ini keputusan yang bergantung pada paket hosting spesifik (lihat OQ-DEPLOY-02).
3. **Jaringan antar server**: set `FACE_SERVICE_URL` di APP mengarah ke alamat publik/VPN Server 2. **WAJIB HTTPS** kalau melewati internet terbuka — JANGAN kirim foto siswa atau `X-Internal-Service-Key` lewat HTTP polos antar server (lihat 03-SAD.md OQ-SAD-03).
4. **Redis & PostgreSQL**: taruh di server yang punya akses root penuh (biasanya Server 2, bukan cPanel shared hosting) — cPanel shared hosting jarang mengizinkan instalasi Redis/PostgreSQL kustom.
5. Jalankan `npm run db:seed` sekali di awal (lihat README.md kode sumber) untuk membuat role + akun SUPER_ADMIN pertama.

**PENTING**: kalau salah satu dari dua server ini adalah unit yang bisa dipindah-pindah fisik (mis. mini PC), seluruh kewajiban backup & playbook relokasi di §6–8 di atas TETAP BERLAKU untuk server tersebut secara spesifik — pindahkan hanya server itu sesuai prosedur, server yang lain (yang tidak berpindah) tidak perlu ikut prosedur relokasi.

## OPEN QUESTIONS

- OQ-DEPLOY-01: Platform orkestrasi final (Kubernetes, Docker Swarm, atau PaaS) belum ditentukan — memengaruhi detail konfigurasi rolling deployment.
- OQ-DEPLOY-02: Jenis paket cPanel (shared vs VPS root) belum dikonfirmasi — menentukan apakah Worker/Redis/PostgreSQL bisa jalan di server yang sama dengan APP, atau wajib di server ke-2 (lihat 15-INFRASTRUCTURE-SPEC.md OQ-INFRA-03).
