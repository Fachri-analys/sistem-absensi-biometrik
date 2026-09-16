# 10 — Test Plan
## Sistem Absensi Biometrik Sekolah

---

## 1. Jenis Pengujian

| Jenis | Cakupan |
|---|---|
| Unit | Fungsi murni: validasi input, kalkulasi status (ON_TIME/LATE), utilitas kriptografi/hashing |
| Integration | Interaksi API ↔ PostgreSQL ↔ Redis dalam satu service, tanpa mock database |
| API | Kontrak endpoint sesuai 05-API-SPEC.md (request/response/status code/error) |
| Database | Migrasi schema, constraint (unique NISN, FK), index performa query |
| Redis | Cache-aside behavior, TTL, invalidasi, rate limiting |
| Queue | Job enqueue/dequeue, retry, backoff, dead-letter |
| Worker | Idempotency job, penanganan crash di tengah proses |
| Security | RBAC enforcement, SQLi/XSS/CSRF, exposure data biometrik |
| E2E | Alur penuh: kamera kirim hasil recognition → tersimpan → tampil di dashboard realtime |
| Load Test | Beban presensi serentak saat jam masuk sekolah |
| Stress Test | Beban di atas kapasitas untuk menemukan titik gagal |
| Failover Test | Kegagalan Redis/PostgreSQL/Worker saat sistem berjalan |
| Sync Test | Full/incremental sync, retry, upsert idempotency |
| Realtime Test | Latensi event WebSocket/SSE dari simpan data ke tampil di UI |

## 2. Skenario Penting & Acceptance Criteria

| ID | Skenario | Acceptance Criteria |
|---|---|---|
| TC-ATT-001 | Presensi valid (skor ≥ threshold, liveness passed) | Record attendance tersimpan, status ON_TIME/LATE sesuai jadwal, event realtime terkirim ≤2 detik |
| TC-ATT-002 | Duplicate attendance dalam jendela waktu | Request kedua dengan idempotency key sama tidak membuat record baru (FR-ATTENDANCE-003) |
| TC-ATT-003 | Simultaneous attendance (banyak siswa bersamaan) | Tidak ada race condition menyebabkan data hilang/duplikat pada beban ≥N request/detik (nilai N sesuai NFR-PERF target) |
| TC-ATT-004 | Skor kecocokan di bawah threshold | Tidak tercatat sebagai attendance valid, direspons 422, tidak dianggap kehadiran (FR-ATTENDANCE-002) |
| TC-ATT-005 | Liveness gagal (kemungkinan spoof) | Ditolak, tidak tercatat sebagai kehadiran, dicatat untuk audit keamanan |
| TC-INFRA-001 | Redis unavailable saat presensi berjalan | Attendance tetap tersimpan ke PostgreSQL (cache miss diterima), dashboard fallback ke polling REST (NFR-AVAIL-001) |
| TC-INFRA-002 | PostgreSQL unavailable | API attendance mengembalikan 503 dengan retry-after, tidak terjadi silent data loss |
| TC-QUEUE-001 | Worker crash di tengah job report-generation | Job diproses ulang oleh worker lain tanpa menghasilkan file laporan duplikat/korup (idempotent by reportId) |
| TC-QUEUE-002 | Queue backlog menumpuk | Sistem tetap menerima presensi baru (tidak blocking), backlog diproses bertahap sesuai concurrency worker |
| TC-SYNC-001 | External API timeout saat full sync | Sesi sync dicatat FAILED/PARTIAL di sync_logs, data lokal tidak terhapus, dapat di-retry |
| TC-SYNC-002 | Duplicate sync (menjalankan ulang sesi yang sama) | Tidak ada duplikasi record, hasil akhir identik dengan satu kali eksekusi (idempotent upsert) |
| TC-CAM-001 | Invalid face match (skor rendah tapi liveness lolos) | Tidak tercatat sebagai kehadiran valid, muncul di log untuk review manual operator |
| TC-STORAGE-001 | Expired presigned URL | Akses ditolak setelah masa berlaku habis, klien harus meminta URL baru |
| TC-SEC-001 | Unauthorized API access (tanpa token/token invalid) | Seluruh endpoint terproteksi mengembalikan 401, tidak ada data bocor di error message |
| TC-SEC-002 | Role restriction (mis. OPERATOR mencoba hapus siswa) | Ditolak dengan 403, tercatat sebagai upaya di audit log |
| TC-SEC-003 | Percobaan mengakses data biometrik dari endpoint publik | Tidak ada field embedding pada response API mana pun (verifikasi otomatis via schema/contract test) |
| TC-ENROLL-001 | Enrolment berhasil (foto softfile valid, satu wajah jelas) | Embedding tersimpan di `biometric_profiles`, foto sumber terhapus permanen dari storage dalam ≤5 menit (FR-ENROLL-004, FR-ENROLL-005) |
| TC-ENROLL-002 | Enrolment gagal (kualitas foto tidak memenuhi syarat/wajah tidak terdeteksi) | Embedding tidak tersimpan, kegagalan tercatat di audit log, foto sumber tetap terhapus permanen meski gagal (FR-ENROLL-005) |
| TC-ENROLL-003 | Batch upload dengan sebagian file gagal | File yang valid tetap berhasil diproses, file gagal dilaporkan per item tanpa menggagalkan seluruh batch (FR-ENROLL-002) |

## 3. Environment Pengujian

Staging environment yang meniru topologi produksi (APP multi-instance, Redis, PostgreSQL, minimal 1 worker) untuk integration/E2E/load test. Unit test dijalankan di CI tanpa dependency eksternal (mock/in-memory database untuk unit murni, database nyata untuk integration).

## 4. Status Implementasi Aktual (bukan rencana — ini yang benar-benar sudah dijalankan)

Berbeda dari bagian 1–3 di atas (rencana pengujian menyeluruh), bagian ini mencatat apa yang **benar-benar sudah ditulis dan dijalankan** di kode sumber, supaya tidak ada kerancuan antara "direncanakan" dan "terbukti":

| Kategori | Status | Lokasi |
|---|---|---|
| Unit test — batas hari sekolah (WIB vs UTC) | **35 test, lulus semua** | `src/lib/__tests__/school-time.test.ts` — mengunci bug pergantian hari yang pernah ditemukan (presensi jam 6 pagi WIB salah terhitung hari sebelumnya kalau pakai UTC) |
| Unit test — status ON_TIME/LATE | Lulus | `src/lib/__tests__/resolve-attendance-status.test.ts` |
| Unit test — validasi Zod (NISN, pagination, dsb) | Lulus | `src/lib/__tests__/validation.test.ts` |
| Unit test — hashing API key kios (HMAC) | Lulus | `src/lib/__tests__/camera-key.test.ts` |
| Integration test (Testcontainers, Postgres asli) — race condition TC-ATT-003 | **Ditulis, TAPI belum pernah dijalankan sampai selesai** — lingkungan pengembangan tidak punya Docker daemon (dibutuhkan Testcontainers). Kode diverifikasi benar secara API (Prisma `datasourceUrl`, `@testcontainers/postgresql` API dicek langsung terhadap package terinstal), tapi belum terbukti lulus di database sungguhan. **WAJIB dijalankan (`npm run test:integration`) di mesin dengan Docker sebelum dianggap terbukti.** | `tests/integration/attendance-race-condition.test.ts` |
| Load/concurrency test (TC-ATT-003, race condition banyak siswa check-in bersamaan) | **Belum dijalankan** — perbaikan unique constraint DB sudah ada di kode, tapi belum dibuktikan dengan tembakan request paralel sungguhan | - |
| Face Service — deteksi wajah + embedding + compare | **Diuji manual dengan foto asli** (skimage astronaut.png) saat pengembangan — similarity foto identik = 1.0 sesuai ekspektasi. Bukan automated test yang jalan di CI. | `face-service/README.md` |
| Face Service — liveness detection | **BELUM diuji sama sekali dengan model/foto asli** — lihat `face-service/models/README.md`. Endpoint fail-closed tanpa model terpasang. | - |
| E2E (dari browser HP siswa sampai tercatat di dashboard) | **Belum ada** | - |

## OPEN QUESTIONS

- OQ-TEST-01: Nilai target throughput (N request/detik) untuk TC-ATT-003 bergantung pada jumlah siswa aktual sekolah (lihat OQ-PRD/OQ-SRS terkait performa).
- OQ-TEST-02: Dua prioritas pengujian tersisa sebelum go-live: (a) **menjalankan** integration test race condition yang sudah ditulis (`tests/integration/attendance-race-condition.test.ts`) di mesin dengan Docker — kodenya ada tapi belum pernah lulus dijalankan, dan (b) validasi liveness detection dengan foto asli vs foto spoof (lihat face-service/models/README.md) — ini belum ada kodenya sama sekali, masih menunggu file model. (b) lebih kritis karena menyangkut keamanan langsung terhadap siswa sungguhan.
