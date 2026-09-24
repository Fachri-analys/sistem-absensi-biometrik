# Sistem Absensi Biometrik

Sistem presensi siswa berbasis verifikasi wajah 1:1. Siswa memasukkan NISN,
mengambil foto dari kamera HP, lalu aplikasi memverifikasi liveness dan
kecocokan wajah dengan template enrolment.

> **Status penting:** ini masih proyek pengembangan. Model liveness wajib
> dipasang dan diuji dengan foto asli serta foto spoof sebelum dipakai di
> lingkungan sekolah.

## Mulai dari sini

| Kebutuhan | Dokumen |
| --- | --- |
| Menjalankan aplikasi sehari-hari | [`project/README.md`](project/README.md) |
| Menjalankan Face Service Python | [`project/face-service/README.md`](project/face-service/README.md) |
| Memasang model liveness | [`project/face-service/models/README.md`](project/face-service/models/README.md) |
| Memahami arsitektur dan keputusan teknis | [`docs/README.md`](docs/README.md) |
| Menyiapkan deployment dan operasi | [`docs/11-DEPLOYMENT.md`](docs/11-DEPLOYMENT.md), [`docs/12-OPERATIONS.md`](docs/12-OPERATIONS.md) |
| Memeriksa status pengujian dan gap yang tersisa | [`docs/10-TEST-PLAN.md`](docs/10-TEST-PLAN.md) |

## Struktur repository

```text
.
├── docs/                  # PRD, SRS, arsitektur, API, keamanan, deployment
├── project/
│   ├── src/               # Next.js App Router dan API
│   ├── worker/            # Worker BullMQ untuk pekerjaan asinkron
│   ├── prisma/            # Schema, migration, dan seeder PostgreSQL
│   ├── face-service/      # Microservice Python untuk biometrik
│   ├── tests/             # Integration test
│   ├── docker-compose.yml # PostgreSQL, Redis, APP, dan Worker
│   └── package.json       # Script pengembangan dan pengujian
└── README.md
```

## Arsitektur singkat

- **APP:** Next.js 14 + TypeScript, REST API, autentikasi admin, dashboard,
  dan endpoint check-in.
- **Worker:** proses terpisah yang membaca queue BullMQ dari Redis.
- **PostgreSQL:** source of truth untuk siswa, kelas, presensi, dan konfigurasi.
- **Face Service:** Python + InsightFace + MiniFASNet, dipanggil APP melalui
  jaringan internal dan tidak boleh diekspos langsung ke browser.
- **Redis:** cache, rate limit, dan backend queue.

## Alur kontribusi

1. Baca [panduan pengembangan](project/README.md#alur-pengembangan).
2. Buat branch dari `main`; jangan bekerja langsung di `main`.
3. Jalankan typecheck, lint, dan unit test sebelum membuat pull request.
4. Untuk perubahan schema, sertakan migration dan perbarui dokumentasi terkait.
5. Untuk perubahan biometrik atau data pribadi, baca
   [`docs/06-SECURITY-SPEC.md`](docs/06-SECURITY-SPEC.md) terlebih dahulu.

Jangan commit `.env`, secret, file model, foto siswa, atau data produksi.
