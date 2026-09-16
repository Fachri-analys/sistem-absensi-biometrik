# 08 — Redis / Cache Specification
## Sistem Absensi Biometrik Sekolah

Prinsip dasar: Redis BUKAN source of truth. Kehilangan seluruh isi Redis tidak boleh menyebabkan kehilangan data — hanya penurunan performa sementara (cache miss, fallback ke PostgreSQL).

---

## 1. Cache Keys

| Key Pattern | Isi | TTL | Invalidasi |
|---|---|---|---|
| `dashboard:stats:{date}:{scope}` | Statistik agregat kehadiran (scope = `all` atau `class:{classId}`) | 30 detik | Event-driven saat attendance baru masuk untuk tanggal terkait, ditambah TTL sebagai pengaman |
| `students:{id}` | Detail siswa (tanpa data biometrik) | 5 menit | Saat `PUT/DELETE /api/students/:id` sukses |
| `classes:list` | Daftar kelas lengkap dengan relasi jurusan/wali kelas | 10 menit | Saat CRUD classes/majors/teachers sukses |
| `attendance:latest:{limit}` | N record kehadiran terbaru untuk panel live log | 5 detik | Event-driven saat attendance baru masuk |
| `auth:session:{tokenHash}` | Metadata sesi user aktif (untuk validasi cepat token) | Sesuai masa berlaku token | Saat logout / revoke |
| `ratelimit:{scope}:{identifier}` | Counter token bucket rate limiting (login, API, camera) | Sesuai jendela rate limit | Kedaluwarsa alami |
| `lock:sync:{entityType}` | Distributed lock agar sinkronisasi entity yang sama tidak berjalan paralel | Sesuai estimasi durasi sync + buffer | Dilepas eksplisit oleh worker saat selesai/gagal |

## 2. Strategi Cache-Aside

Pola default: aplikasi membaca cache terlebih dahulu; jika miss, baca dari PostgreSQL, lalu tulis ke cache dengan TTL yang ditentukan. Penulisan data (write) selalu ke PostgreSQL terlebih dahulu (source of truth), lalu cache terkait diinvalidasi (delete key), bukan diperbarui langsung — untuk menghindari inkonsistensi antara data yang di-cache dan hasil transaksi yang mungkin gagal parsial.

## 3. Cache Stampede Protection

Untuk key bertrafik tinggi (`dashboard:stats:*`, `attendance:latest:*`), gunakan salah satu dari:
- Early recomputation (refresh sebelum TTL benar-benar habis oleh satu request yang memegang lock singkat), atau
- Distributed lock singkat (`lock:recompute:{key}`) agar hanya satu proses yang menghitung ulang dari PostgreSQL saat cache miss bersamaan, request lain menunggu sebentar atau menerima data sedikit basi (stale-while-revalidate).

## 4. Distributed Lock

Digunakan untuk: mencegah sinkronisasi entity yang sama berjalan paralel (`lock:sync:{entityType}`), dan mencegah pemrosesan job report generation duplikat untuk request identik dalam jendela singkat. Implementasi menggunakan pola Redlock sederhana (SET NX PX + lease time) sesuai skala single-instance Redis pada MVP.

## 5. Rate Limiting

Token bucket / fixed window counter di Redis untuk:
- Login (`ratelimit:login:{ip}:{email}`) — FR-AUTH-002.
- API user umum (`ratelimit:api:{userId}`).
- API kamera (`ratelimit:camera:{cameraId}`).

## 6. Data yang BOLEH Di-cache

Data agregat non-sensitif dan data master yang jarang berubah: statistik dashboard, daftar kelas/jurusan, detail siswa (tanpa biometrik), hasil pencarian yang sering diakses berulang.

## 7. Data yang TIDAK BOLEH Di-cache

- Data `biometric_profiles` (embedding) dalam bentuk apa pun — tidak pernah masuk Redis.
- Password hash atau token mentah yang belum di-hash.
- Payload lengkap request sinkronisasi yang memuat data sensitif dari sistem eksternal (hanya hasil ringkas/status yang boleh di-cache bila diperlukan).

## OPEN QUESTIONS

- OQ-CACHE-01: Apakah dibutuhkan Redis Cluster/Sentinel untuk HA sejak MVP atau cukup single instance dengan backup RDB/AOF di fase awal — bergantung SLA yang disepakati (lihat OQ-SRS-03).
