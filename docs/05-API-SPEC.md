# 05 — API Specification
## Sistem Absensi Biometrik Sekolah

Konvensi umum:
- Base URL: `/api`
- Format: JSON, `Content-Type: application/json` (kecuali endpoint upload file: `multipart/form-data`).
- Auth: Bearer token (session token, cookie) untuk endpoint admin/dashboard; `X-Camera-Key` untuk kios/kamera tepercaya opsional; **`POST /api/attendance/checkin` PUBLIK tanpa autentikasi apa pun** (lihat 06-SECURITY-SPEC.md untuk model kepercayaannya).
- Error format standar: `{ "error": { "code": string, "message": string, "details"?: object } }`.
- Pagination standar (list endpoint): query `?page=&pageSize=`, response menyertakan `{ "data": [...], "meta": { "page", "pageSize", "total" } }`.
- Rate limit standar: 60 request/menit per user untuk endpoint admin biasa, 300 request/menit per device untuk kios/kamera opsional, 10/menit-per-NISN + 30/menit-per-IP untuk check-in publik (dikonfigurasi via Redis token bucket).

---

## Authentication

### POST /api/auth/login
- Purpose: autentikasi user, menerbitkan session token.
- Auth: tidak perlu (public, tapi rate-limited).
- Request: `{ "email": string, "password": string }`
- Response 200: `{ "token": string, "user": { "id", "email", "fullName", "role" } }`
- Errors: 400 (validasi), 401 (kredensial salah), 429 (terlalu banyak percobaan)
- Validation: email format valid, password non-empty.
- Rate limit: 5 percobaan gagal/15 menit per IP+email (FR-AUTH-002).
- Idempotency: tidak relevan (bukan operasi mutasi state selain audit log percobaan).

### POST /api/auth/logout
- Purpose: invalidasi token aktif.
- Auth: required (any role).
- Request: tanpa body (token dari header).
- Response 200: `{ "success": true }`
- Errors: 401 (token tidak valid).

### GET /api/auth/me
- Purpose: mengambil profil user aktif.
- Auth: required.
- Response 200: `{ "id", "email", "fullName", "role", "homeroomClassId"? }`
- Errors: 401.

---

## Students

### GET /api/students
- Purpose: daftar siswa dengan filter & pencarian.
- Auth: required (ADMIN, OPERATOR, WALI_KELAS [terbatas kelasnya], VIEWER, SUPER_ADMIN).
- Query: `search`, `classId`, `majorId`, `page`, `pageSize`.
- Response 200: paginated list siswa (tanpa data biometrik).
- Authorization: WALI_KELAS hanya menerima data kelas yang diampu (filter dipaksa di server, bukan hanya di client).
- Rate limit: standar.

### GET /api/students/:id
- Purpose: detail satu siswa.
- Auth: required, otorisasi sama seperti di atas.
- Response 200: detail siswa + kelas + jurusan + wali kelas (tanpa biometrik).
- Errors: 404 jika tidak ditemukan/soft-deleted.

### POST /api/students
- Purpose: membuat siswa baru.
- Auth: required (ADMIN, SUPER_ADMIN).
- Request: `{ "nisn", "fullName", "classId", "gender"? }`
- Response 201: data siswa terbuat.
- Validation: NISN unik & format sesuai standar, classId harus ada.
- Errors: 400, 409 (NISN duplikat).
- Audit: dicatat sebagai STUDENT_CREATE.

### PUT /api/students/:id
- Purpose: memperbarui data siswa.
- Auth: required (ADMIN, SUPER_ADMIN).
- Response 200: data terbaru.
- Errors: 400, 404, 409.
- Audit: STUDENT_UPDATE dengan before/after snapshot.

### DELETE /api/students/:id
- Purpose: soft delete siswa.
- Auth: required (ADMIN, SUPER_ADMIN).
- Response 200: `{ "success": true }`
- Errors: 404.
- Audit: STUDENT_DELETE.

---

## Biometric Enrollment

### POST /api/students/:id/biometric-enrollment
- Purpose: enrolment biometrik satu siswa via upload foto softfile.
- Auth: required (ADMIN, SUPER_ADMIN).
- Request: `multipart/form-data` dengan field `photo` (file gambar).
- Response 202: `{ "enrollmentId": string, "status": "PROCESSING" }` — diproses asinkron via job `face-enrollment` (lihat 09-QUEUE-WORKER-SPEC.md).
- Validation: tipe file (jpeg/png), ukuran maksimum (lihat 15-INFRASTRUCTURE-SPEC.md), tepat satu wajah terdeteksi (divalidasi di worker, hasil dilaporkan async).
- Errors: 400 (validasi format), 404 (siswa tidak ditemukan), 409 (enrolment sedang berjalan untuk siswa yang sama).
- Efek samping wajib: foto sumber dihapus permanen dari storage setelah job selesai — baik hasil sukses maupun gagal (FR-ENROLL-005).
- Audit: ENROLLMENT_REQUESTED, ENROLLMENT_SUCCESS/ENROLLMENT_FAILED (tanpa foto/embedding di snapshot).

### POST /api/students/biometric-enrollment/batch
- Purpose: batch upload foto softfile untuk banyak siswa sekaligus.
- Auth: required (ADMIN, SUPER_ADMIN).
- Request: `multipart/form-data` berisi beberapa file, masing-masing dipetakan ke siswa via nama file yang memuat NISN/external_id, atau manifest JSON terpisah yang memetakan `{ nisn/externalId → filename }` (format manifest final ditentukan bersama tim implementasi).
- Response 202: `{ "batchId": string, "totalFiles": number, "status": "PROCESSING" }`
- Flow: setiap file dienqueue sebagai job `face-enrollment` individual — kegagalan satu file tidak menghentikan file lain dalam batch.
- Errors: 400 (manifest tidak valid), 404 (ada siswa yang tidak ditemukan — dilaporkan per file, bukan menggagalkan seluruh batch).

### GET /api/students/:id/biometric-enrollment/status
- Purpose: memeriksa status enrolment terbaru seorang siswa (SUCCESS/FAILED/PROCESSING/NOT_ENROLLED).
- Auth: required (ADMIN, SUPER_ADMIN).
- Response 200: `{ "status": string, "enrolledAt"?: ISODate, "lastFailureReason"?: string }` — tidak pernah mengembalikan foto atau embedding.

---

## Classes

### GET /api/classes
- Purpose: daftar kelas.
- Auth: required (semua role, VIEWER/WALI_KELAS read-only).
- Response 200: list kelas + relasi jurusan & wali kelas.

### POST /api/classes
- Purpose: membuat kelas.
- Auth: required (ADMIN, SUPER_ADMIN).
- Request: `{ "name", "majorId", "homeroomTeacherId"? }`
- Errors: 400, 404 (majorId/teacherId tidak ditemukan).
- Audit: CLASS_CREATE.

### PUT /api/classes/:id
- Purpose: memperbarui kelas.
- Auth: required (ADMIN, SUPER_ADMIN).
- Audit: CLASS_UPDATE.

---

## Majors

### GET /api/majors
- Auth: required (semua role).
- Response 200: list jurusan.

### POST /api/majors
- Auth: required (ADMIN, SUPER_ADMIN).
- Request: `{ "name", "code" }`
- Errors: 409 (code duplikat).
- Audit: MAJOR_CREATE.

---

## Attendance

### GET /api/attendance
- Purpose: log absensi dengan filter.
- Auth: required (semua role, WALI_KELAS terbatas kelasnya).
- Query: `classId`, `status`, `dateFrom`, `dateTo`, `search`, `page`, `pageSize`.
- Response 200: paginated attendance record (join ringkas ke student/class, tanpa data biometrik).

### GET /api/attendance/today
- Purpose: statistik & daftar kehadiran hari berjalan.
- Auth: required.
- Response 200: `{ "stats": {...}, "records": [...] }`
- Cache: hasil di-cache Redis dengan TTL pendek (lihat 08-CACHE-SPEC.md), invalidasi saat ada attendance baru.

### GET /api/attendance/latest
- Purpose: N record terbaru untuk panel live log dashboard.
- Auth: required.
- Query: `limit` (default 5, max 50).

### POST /api/attendance/checkin
- Purpose: **jalur presensi UTAMA** — siswa presensi mandiri dari HP pribadi.
- Auth: **PUBLIK, tanpa autentikasi device/password** — siswa cukup mengetik NISN. Wajah adalah faktor pembuktian utama (lihat 06-SECURITY-SPEC.md).
- Request: `multipart/form-data` dengan field `nisn` (string, 10 digit) dan `photo` (file gambar, JPEG/PNG, maks 5MB).
- Response 201: `{ "status": "ON_TIME" | "LATE", "recordedAt": ISODate, "studentName": string }`
- Response error (generik, TIDAK membedakan sebab — anti-enumeration): 422 `"NISN tidak ditemukan, belum terdaftar wajahnya, atau wajah tidak cocok"`.
- Validation: NISN format 10 digit, foto sesuai batas tipe/ukuran.
- Alur internal: (1) rate limit per NISN+IP, (2) cari siswa by NISN + ambil `embeddingRef` tersimpan, (3) kirim foto ke Face Service (internal) untuk liveness check, (4) jika liveness lolos, generate embedding dari foto live, (5) bandingkan 1:1 dengan template tersimpan via Face Service, (6) jika similarity ≥ threshold (90%), lanjut ke pengecekan dedup + insert attendance (identik dengan alur `POST /api/attendance` di bawah, channel `STUDENT_PHONE`, `cameraId: null`).
- **Foto mentah TIDAK PERNAH ditulis ke Object Storage** — diproses di memori server selama request, dibuang setelah selesai (FR-CHECKIN-005).
- Idempotency: `idempotencyKey` di-generate SERVER-SIDE (bukan dari klien) — kombinasi studentId+timestamp+random, karena siswa tidak mengirim key sendiri di alur ini.
- Errors: 400 (validasi format), 409 (duplikat dalam jendela waktu ATAU sudah presensi hari ini — race condition ditangani via unique constraint database, lihat 04-ERD.md), 422 (liveness gagal/similarity kurang — pesan generik), 429 (rate limit per NISN atau per IP terlampaui).
- Rate limit: 10 percobaan/10 menit per NISN, 30 percobaan/10 menit per IP (FR-CHECKIN-006) — menggantikan peran autentikasi device karena endpoint ini publik.

### POST /api/attendance (Kios/Kamera Tepercaya — Opsional)
- Purpose: mencatat hasil presensi dari **kios/kamera tepercaya milik sekolah** — jalur OPSIONAL, bukan untuk HP siswa (lihat POST /api/attendance/checkin untuk itu).
- Auth: `X-Camera-Key` (API key device, bukan user token) — hanya cocok untuk perangkat yang benar-benar dikelola sekolah, TIDAK PERNAH dipasang di kode client-side yang bisa diekstrak siswa.
- Request: `{ "studentId": string, "matchScore": number, "livenessPassed": boolean, "recordedAt": ISODate, "idempotencyKey": string }`
- Response 201: record attendance tersimpan + status (ON_TIME/LATE), channel `KIOSK`.
- Validation: matchScore ≥ threshold kelas (FR-ATTENDANCE-002), cameraId valid & terdaftar.
- Idempotency: request harus menyertakan `idempotencyKey` (mis. kombinasi cameraId+studentId+timestamp terkuantisasi) agar retry jaringan dari device tidak menghasilkan duplikat (FR-ATTENDANCE-003).
- Errors: 400 (validasi), 401 (API key device tidak valid), 409 (duplikat dalam jendela waktu), 422 (skor di bawah threshold).
- Rate limit: 300 req/menit per device.
- **Catatan desain**: endpoint ini SENGAJA mempercayai `matchScore`/`livenessPassed` dari pemanggil — ini valid HANYA karena pemanggilnya adalah device tepercaya dengan API key rahasia yang tidak pernah dipegang siswa. JANGAN gunakan pola yang sama untuk endpoint yang bisa dipanggil dari kode client-side (lihat perbandingan trust model di 03-SAD.md §6).

---

## Dashboard

### GET /api/dashboard/stats
- Purpose: agregat statistik untuk kartu dashboard (total siswa, hadir, terlambat, izin/sakit).
- Auth: required (semua role, terfilter kelas untuk WALI_KELAS).
- Cache: Redis, key `dashboard:stats:{date}:{scope}`, TTL singkat, invalidasi event-driven.

---

## Cameras

### GET /api/cameras
- Auth: required (ADMIN, OPERATOR, SUPER_ADMIN).
- Response 200: list kamera + status terakhir.

### POST /api/cameras
- Auth: required (ADMIN, SUPER_ADMIN).
- Request: `{ "name", "location" }`
- Response 201: kamera baru + `apiKey` (ditampilkan sekali saat pembuatan, selanjutnya hanya hash tersimpan).
- Audit: CAMERA_CREATE.

### PUT /api/cameras/:id
- Auth: required (ADMIN, SUPER_ADMIN).
- Purpose: update konfigurasi/status kamera, atau regenerasi API key.
- Audit: CAMERA_UPDATE.

---

## Reports

### POST /api/reports/export
- Purpose: memicu pembuatan laporan (PDF) secara asinkron.
- Auth: required (ADMIN, WALI_KELAS [kelasnya sendiri], VIEWER, SUPER_ADMIN).
- Request: `{ "type": "ATTENDANCE_EXPORT", "filter": { "classId"?, "dateFrom", "dateTo" } }`
- Response 202: `{ "reportId": string, "status": "PENDING" }`
- Flow: enqueue job report-generation → worker generate PDF → upload object storage → status DONE dengan presigned URL sementara.
- Polling: `GET /api/reports/:id` (tidak didaftarkan eksplisit di prompt asal, ditambahkan sebagai kebutuhan turunan wajar — ditandai OPEN QUESTION penamaan endpoint final).
- Idempotency: request export dengan filter identik dalam jendela singkat dapat mengembalikan reportId yang sama (dedup) — kebijakan pasti OPEN QUESTION.

---

## Sync

### POST /api/sync/students
- Auth: required (ADMIN, SUPER_ADMIN).
- Request: `{ "mode": "FULL" | "INCREMENTAL" }`
- Response 202: `{ "syncLogId": string, "status": "RUNNING" }`
- Flow: enqueue job data-sync → sync worker proses → update sync_logs.

### POST /api/sync/classes
### POST /api/sync/teachers
Sama pola dengan `/api/sync/students`, entity berbeda.

### GET /api/sync/status
- Purpose: status sinkronisasi terkini/berjalan per entity.
- Auth: required (ADMIN, SUPER_ADMIN).

### GET /api/sync/logs
- Purpose: riwayat sinkronisasi dengan detail sukses/gagal.
- Auth: required (ADMIN, SUPER_ADMIN).
- Query: `entityType`, `status`, `page`, `pageSize`.

---

---

## Realtime

### GET /api/realtime/attendance
- Purpose: Server-Sent Events (SSE) stream event kehadiran baru untuk dashboard (FR-SYNC-REALTIME-001).
- Auth: required (semua role, WALI_KELAS terfilter kelasnya — event di luar kelasnya tidak dikirim, difilter di server).
- Query: `classId` (opsional, mengikuti aturan scoping yang sama seperti endpoint attendance lain).
- Response: `Content-Type: text/event-stream`. Event `connected` saat koneksi dibuka, event `attendance` untuk tiap presensi baru (payload sama dengan record attendance ringkas), komentar heartbeat setiap 25 detik untuk menjaga koneksi tetap hidup melewati proxy/load balancer.
- Implementasi: SSE dipilih dibanding WebSocket penuh karena arah data satu jalur (server→klien) dan didukung native oleh Next.js Route Handler tanpa server terpisah. Klien WAJIB tetap punya fallback polling ke `GET /api/attendance/latest` — koneksi SSE terputus tidak dianggap sebagai kegagalan sistem (NFR-AVAIL-001).
- Errors: 401/403 mengikuti pola endpoint lain, dikembalikan sebelum stream dibuka.

---

---

## Face Service (Internal — Tidak Diekspos ke Publik)

Microservice Python terpisah, dipanggil server-ke-server dari APP (`X-Internal-Service-Key`). Spesifikasi endpoint lengkap ada di `face-service/README.md` dan `face-service/app/main.py` pada kode sumber, bukan diduplikasi di sini — ringkasan:

- `GET /health`, `GET /ready` — health/readiness check.
- `POST /v1/quality` — validasi kualitas foto statis (enrolment).
- `POST /v1/liveness` — deteksi liveness dari foto live capture (check-in).
- `POST /v1/embedding` — generate + enkripsi embedding.
- `POST /v1/compare` — perbandingan 1:1 dua embedding terenkripsi.

## Health

### GET /api/health
- Purpose: liveness check dasar (proses hidup).
- Auth: tidak perlu.
- Response 200: `{ "status": "ok" }`

### GET /api/ready
- Purpose: readiness check — memverifikasi koneksi PostgreSQL & Redis sehat.
- Auth: tidak perlu (dibatasi jaringan internal/LB saja).
- Response 200: `{ "status": "ready", "checks": { "postgres": "ok", "redis": "ok" } }` atau 503 jika ada dependency gagal.

## OPEN QUESTIONS

- OQ-API-01: Endpoint `GET /api/reports/:id` untuk polling status export belum ada di daftar minimal prompt asal — perlu konfirmasi apakah ditambahkan resmi.
- ~~OQ-API-02: Mekanisme autentikasi kamera~~ — tetap berlaku HANYA untuk jalur KIOSK opsional (lihat POST /api/attendance); jalur utama (checkin) tidak memakai API key sama sekali (lihat FR-CHECKIN-001).
