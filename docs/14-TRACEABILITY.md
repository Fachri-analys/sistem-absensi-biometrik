# 14 — Traceability Matrix
## Sistem Absensi Biometrik Sekolah

Menghubungkan PRD → Requirement → Feature → API → Database → Test Case, agar setiap requirement penting dapat ditelusuri hingga pengujian.

---

| PRD Ref | Requirement | Feature | API | Database | Test Case |
|---|---|---|---|---|---|
| PRD-ATT-001 (pipeline presensi) | FR-CHECKIN-001..006 | Presensi mandiri via HP siswa (jalur UTAMA) | `POST /api/attendance/checkin` | `attendance`, `students`, `biometric_profiles` | TC-ATT-001, TC-CHECKIN-001 (baru, lihat 10-TEST-PLAN.md) |
| PRD-ATT-001 | FR-ATTENDANCE-001 | Pencatatan hasil recognition via kios/kamera (jalur opsional) | `POST /api/attendance` | `attendance`, `cameras`, `students` | TC-ATT-001 |
| PRD-ATT-001 | FR-ATTENDANCE-002 | Validasi threshold kecocokan (berlaku kedua channel) | `POST /api/attendance/checkin`, `POST /api/attendance` | `attendance_settings`, `attendance` | TC-ATT-004 |
| PRD-ATT-001 | FR-ATTENDANCE-003 | Deduplikasi presensi + unique constraint DB (berlaku kedua channel) | `POST /api/attendance/checkin`, `POST /api/attendance` | `attendance` (`@@unique([studentId, attendanceDate])`) | TC-ATT-002, TC-ATT-003 |
| PRD-ATT-001 | FR-ATTENDANCE-004 | Penentuan status ON_TIME/LATE (WIB, bukan UTC) | `POST /api/attendance/checkin`, `POST /api/attendance` | `attendance_settings`, `attendance` | TC-ATT-001 |
| PRD-ATT-001 | FR-ATTENDANCE-005 | Kehadiran hari ini/terbaru | `GET /api/attendance/today`, `GET /api/attendance/latest` | `attendance` | TC-ATT-003 |
| PRD-DASH-001 (dashboard realtime) | FR-DASH-001 | Statistik kehadiran | `GET /api/dashboard/stats` | `attendance`, `students` | TC-ATT-003 |
| PRD-DASH-001 | FR-SYNC-REALTIME-001 | Update realtime dashboard | WebSocket/SSE channel | `attendance` (sumber event) | TC-RT-001 (Realtime Test, lihat 10-TEST-PLAN) |
| PRD-AUTH-001 (autentikasi) | FR-AUTH-001 | Login | `POST /api/auth/login` | `users`, `roles` | TC-SEC-001 |
| PRD-AUTH-001 | FR-AUTH-002 | Rate limit login | `POST /api/auth/login` | Redis `ratelimit:login:*`, `audit_logs` | TC-SEC-001 |
| PRD-AUTH-001 | FR-AUTH-005 | RBAC enforcement | seluruh endpoint terproteksi | `roles`, `users` | TC-SEC-002 |
| PRD-STUDENT-001 (manajemen siswa) | FR-STUDENT-001..004 | CRUD & pencarian siswa | `GET/POST/PUT/DELETE /api/students*` | `students`, `classes` | TC-DATA-001 (Integration/API test terkait CRUD, lihat 10-TEST-PLAN kategori Integration/API) |
| PRD-CAMERA-001 (manajemen kamera) | FR-CAMERA-001, FR-CAMERA-002 | Registrasi & status kamera | `GET/POST/PUT /api/cameras*` | `cameras` | TC-CAM-001 |
| PRD-REPORT-001 (laporan) | FR-REPORT-001 | Export PDF asinkron | `POST /api/reports/export` | `reports` | TC-QUEUE-001 |
| PRD-SYNC-001 (sinkronisasi eksternal) | FR-SYNC-001..005 | Full/incremental sync, upsert idempotent | `POST /api/sync/*`, `GET /api/sync/status`, `GET /api/sync/logs` | `sync_logs`, `sync_errors`, `students`/`classes`/`majors`/`teachers` | TC-SYNC-001, TC-SYNC-002 |
| PRD-SEC-001 (keamanan biometrik) | NFR-SEC-001 | Isolasi data biometrik | Tidak ada endpoint yang expose embedding | `biometric_profiles` | TC-SEC-003 |
| PRD-ENROLL-001 (enrolment biometrik via softfile) | FR-ENROLL-001..006, NFR-SEC-004 | Upload foto softfile manual & batch, hapus otomatis pasca-enrolment | `POST /api/students/:id/biometric-enrollment`, `POST /api/students/biometric-enrollment/batch`, `GET .../status` | `biometric_profiles` (kolom `source_type`), `audit_logs` | TC-ENROLL-001, TC-ENROLL-002, TC-ENROLL-003 |
| PRD-AUDIT-001 (audit) | FR-AUDIT-001, NFR-AUDIT-001 | Pencatatan audit trail | Seluruh endpoint mutasi sensitif | `audit_logs` | TC-SEC-002 |
| PRD-AVAIL-001 (ketersediaan) | NFR-AVAIL-001 | Degradasi anggun saat Redis down | `POST /api/attendance/checkin`, `GET /api/dashboard/stats` | `attendance` (fallback tanpa cache) | TC-INFRA-001 |
| PRD-REL-001 (reliabilitas) | NFR-REL-001 | Idempotency job asinkron | Seluruh job queue | `reports`, `sync_logs`, `attendance` | TC-QUEUE-001, TC-SYNC-002 |

## Catatan

- Test case `TC-RT-001` dan `TC-DATA-001` disebut di 10-TEST-PLAN.md sebagai kategori (Realtime Test, Integration/API Test) — perlu dipecah menjadi ID test case rinci saat tim QA menulis test case eksekusi (test case ID granular adalah pekerjaan turunan dari dokumen ini, bukan bagian dari cakupan traceability level PRD).
- Baris PRD-* di atas adalah identifier turunan yang dibuat untuk keperluan traceability (tidak secara eksplisit didaftarkan di 01-PRD.md sebagai ID formal) — direkomendasikan agar 01-PRD.md diperbarui dengan ID PRD-* formal pada revisi berikutnya agar traceability konsisten dari sumbernya.

## OPEN QUESTIONS

- OQ-TRACE-01: 01-PRD.md saat ini belum memiliki ID requirement formal (PRD-XXX-NNN) secara eksplisit — direkomendasikan ditambahkan pada revisi berikut agar matriks ini sepenuhnya bersumber dari ID resmi, bukan turunan interpretatif.
