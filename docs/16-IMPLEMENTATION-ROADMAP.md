# 16 — Implementation Roadmap
## Sistem Absensi Biometrik Sekolah

---

## PHASE 0 — Documentation & Architecture
- **Objective**: Menyepakati kebutuhan produk dan arsitektur sebelum coding dimulai.
- **Task**: Menyusun dan mereview dokumen 01–15, menyelesaikan sebanyak mungkin OPEN QUESTIONS dengan pemangku kepentingan sekolah.
- **Dependency**: Tidak ada (fase awal).
- **Deliverable**: Seluruh dokumen di `docs/` disetujui sebagai source of truth.
- **Acceptance Criteria**: Tidak ada OPEN QUESTION kritikal (yang memblokir desain database/API) tersisa tanpa keputusan sementara yang disepakati.
- **Risk**: Keputusan tertunda (vendor recognition, provider cloud) dapat menunda desain teknis rinci.

## PHASE 1 — Next.js UI Migration
- **Objective**: Memindahkan UI HTML referensi menjadi aplikasi Next.js (App Router + TypeScript + Tailwind) tanpa merusak kontrak visual yang sudah disetujui.
- **Task**: Setup project Next.js, konversi komponen (sidebar, topbar, hero live scan, statistik, tabel log) menjadi komponen React, integrasi data dummy/mock sementara.
- **Dependency**: PHASE 0.
- **Deliverable**: Dashboard Next.js berjalan dengan data mock, tampilan identik dengan referensi HTML yang sudah disetujui.
- **Acceptance Criteria**: Perbandingan visual side-by-side dengan referensi HTML tidak menunjukkan regresi (aturan #18 — jangan merusak UI/UX yang sudah ada).
- **Risk**: Perbedaan rendering antara HTML statis dan komponen React (state, hydration) memerlukan penyesuaian.

## PHASE 2 — PostgreSQL + Prisma
- **Objective**: Implementasi skema database sesuai 04-ERD.md dan 13-DATA-DICTIONARY.md.
- **Task**: Setup Prisma schema, migrasi awal, seed data dummy untuk development.
- **Dependency**: PHASE 0.
- **Deliverable**: Database berjalan dengan skema lengkap, migrasi tervalidasi.
- **Acceptance Criteria**: Seluruh tabel, constraint (unique NISN, FK), dan index sesuai dokumen ERD.
- **Risk**: Perubahan skema di kemudian hari memerlukan migrasi tambahan — desain awal harus cukup matang untuk mengurangi migrasi besar berulang.

## PHASE 3 — Backend API
- **Objective**: Implementasi endpoint sesuai 05-API-SPEC.md untuk data master (students, classes, majors) dan health check.
- **Task**: Route handler Next.js, validasi input, error handling standar.
- **Dependency**: PHASE 2.
- **Deliverable**: API CRUD data master berfungsi, terhubung ke UI dari PHASE 1.
- **Acceptance Criteria**: Kontrak request/response sesuai spesifikasi, lulus API test dasar.
- **Risk**: Scope creep pada field data master jika kebutuhan sinkronisasi eksternal belum final.

## PHASE 4 — Authentication + RBAC
- **Objective**: Implementasi login, session, dan RBAC 5 role sesuai 02-SRS.md dan 06-SECURITY-SPEC.md.
- **Task**: Hashing password, penerbitan token, middleware otorisasi per endpoint, scoping WALI_KELAS.
- **Dependency**: PHASE 3.
- **Deliverable**: Seluruh endpoint terproteksi sesuai role, login/logout berfungsi.
- **Acceptance Criteria**: TC-SEC-001, TC-SEC-002 lulus.
- **Risk**: Kesalahan scoping RBAC dapat membocorkan data lintas kelas — perlu review keamanan menyeluruh sebelum lanjut.

## PHASE 5 — Redis + Cache
- **Objective**: Implementasi caching sesuai 08-CACHE-SPEC.md untuk dashboard stats dan data master.
- **Task**: Integrasi Redis, cache-aside pattern, rate limiting login/API.
- **Dependency**: PHASE 3, PHASE 4.
- **Deliverable**: Dashboard stats lebih cepat, rate limiting aktif.
- **Acceptance Criteria**: TC-INFRA-001 (Redis unavailable tidak menjatuhkan sistem) lulus.
- **Risk**: Cache invalidation yang salah dapat menampilkan data basi ke dashboard.

## PHASE 6 — Queue + Worker
- **Objective**: Implementasi BullMQ dan worker sesuai 09-QUEUE-WORKER-SPEC.md.
- **Task**: Setup queue attendance-processing, notification, report-generation, data-sync; worker service terpisah.
- **Dependency**: PHASE 5.
- **Deliverable**: Pekerjaan berat (laporan, notifikasi) berjalan asinkron tanpa blocking API.
- **Acceptance Criteria**: TC-QUEUE-001, TC-QUEUE-002 lulus.
- **Risk**: Job tidak idempotent dapat menyebabkan efek ganda (notifikasi dobel, laporan korup).

## PHASE 7 — Object Storage
- **Objective**: Integrasi S3-compatible storage untuk foto siswa dan hasil laporan sesuai 15-INFRASTRUCTURE-SPEC.md.
- **Task**: Setup bucket, presigned URL, validasi upload.
- **Dependency**: PHASE 6 (report-generation membutuhkan storage untuk output).
- **Deliverable**: Foto siswa tampil di UI via presigned URL, laporan PDF dapat diunduh.
- **Acceptance Criteria**: TC-STORAGE-001 lulus.
- **Risk**: Kesalahan kebijakan bucket dapat membocorkan file privat jika bucket tidak benar-benar private.

## PHASE 8 — Biometric Integration
- **Objective**: Integrasi dengan Face Service (InsightFace + MiniFASNet, self-hosted — vendor sudah dipilih, lihat `face-service/README.md`, resolusi OQ-PRD-01) dan tabel `biometric_profiles`.
- **Task**: Implementasi kontrak `attendance-processing`/`face-processing`, isolasi akses biometrik.
- **Dependency**: PHASE 2 (skema database), keputusan vendor dari PHASE 0.
- **Deliverable**: Pipeline presensi menerima hasil recognition nyata (bukan dummy).
- **Acceptance Criteria**: TC-ATT-001, TC-ATT-004, TC-ATT-005, TC-SEC-003 lulus.
- **Risk**: Perubahan vendor di kemudian hari — mitigasi melalui abstraction layer (aturan #5).

## PHASE 9 — Realtime Attendance
- **Objective**: Implementasi WebSocket/SSE untuk update dashboard realtime sesuai FR-SYNC-REALTIME-001.
- **Task**: Channel realtime, publish event dari API saat attendance baru tersimpan.
- **Dependency**: PHASE 3, PHASE 8.
- **Deliverable**: Dashboard log absensi ter-update otomatis tanpa refresh manual.
- **Acceptance Criteria**: Latensi update ≤2 detik terukur di staging (Realtime Test).
- **Risk**: Skala koneksi WebSocket bersamaan saat jam masuk sekolah perlu diuji beban.

## PHASE 10 — External Data Synchronization
- **Objective**: Implementasi sinkronisasi sesuai 07-SYNC-SPEC.md.
- **Task**: Sync Adapter, validasi, worker data-sync, UI status/log sinkronisasi.
- **Dependency**: PHASE 6, kejelasan struktur sistem eksternal (OQ-SYNC-01).
- **Deliverable**: Data siswa/kelas/guru dapat disinkronkan penuh/incremental dengan log yang dapat ditelusuri.
- **Acceptance Criteria**: TC-SYNC-001, TC-SYNC-002 lulus.
- **Risk**: Struktur sistem eksternal yang belum jelas dapat menunda fase ini hingga informasi tersedia.

## PHASE 11 — CDN + Load Balancer
- **Objective**: Menyiapkan infrastruktur produksi untuk distribusi trafik dan asset statis.
- **Task**: Konfigurasi CDN, Load Balancer dengan health check ke `/api/ready`.
- **Dependency**: PHASE 3 (API health/ready sudah ada).
- **Deliverable**: Sistem dapat menerima trafik produksi dengan distribusi merata dan asset statis cepat dimuat.
- **Acceptance Criteria**: Failover satu instance APP tidak mengganggu layanan (TC-INFRA di level infrastruktur).
- **Risk**: Ketergantungan pada provider final yang belum ditentukan (OQ-INFRA-01).

## PHASE 12 — Monitoring + Security Hardening
- **Objective**: Observability penuh dan hardening keamanan sesuai 06-SECURITY-SPEC.md dan 12-OPERATIONS.md.
- **Task**: Structured logging, metrics, alerting, audit log lengkap, review keamanan menyeluruh (rate limiting, CORS, CSRF, dsb.).
- **Dependency**: Seluruh fase fungsional utama (1–10) selesai.
- **Deliverable**: Dashboard monitoring aktif, alert terkonfigurasi, hasil security review terdokumentasi.
- **Acceptance Criteria**: Tidak ada temuan kritikal terbuka dari security review; alerting teruji dengan skenario simulasi.
- **Risk**: Penemuan celah keamanan di fase ini dapat memerlukan perubahan desain mendalam jika ditemukan terlambat — direkomendasikan review keamanan berkala sejak PHASE 3, bukan hanya di akhir.

## PHASE 13 — Testing
- **Objective**: Eksekusi penuh 10-TEST-PLAN.md termasuk load/stress/failover test.
- **Task**: Menjalankan seluruh kategori pengujian di staging, memperbaiki temuan.
- **Dependency**: PHASE 12.
- **Deliverable**: Laporan hasil pengujian, seluruh test case kritikal (P0) lulus.
- **Acceptance Criteria**: Traceability matrix (14-TRACEABILITY.md) menunjukkan seluruh requirement penting memiliki test case yang lulus.
- **Risk**: Ditemukannya bug arsitektural besar di tahap ini dapat menunda jadwal produksi — mitigasi dengan pengujian bertahap sejak fase-fase sebelumnya, bukan hanya di akhir.

## PHASE 14 — Production Deployment
- **Objective**: Rilis ke lingkungan produksi mengikuti 11-DEPLOYMENT.md.
- **Task**: Migrasi database produksi, rolling deployment, verifikasi health check, UAT bersama pihak sekolah.
- **Dependency**: PHASE 13.
- **Deliverable**: Sistem berjalan di produksi dan digunakan oleh sekolah.
- **Acceptance Criteria**: UAT disetujui pihak sekolah, tidak ada insiden P0 dalam periode observasi awal (mis. 2 minggu pertama — durasi pasti OPEN QUESTION).
- **Risk**: Masalah yang hanya muncul pada skala data/pengguna nyata sekolah (berbeda dari staging) — mitigasi dengan monitoring ketat pasca-rilis dan rencana rollback siap pakai.

## OPEN QUESTIONS

- OQ-ROADMAP-01: Estimasi durasi per fase belum ditentukan — bergantung ukuran tim dan kecepatan keputusan pada OPEN QUESTIONS lintas dokumen (vendor recognition, struktur sistem eksternal, provider infrastruktur).
