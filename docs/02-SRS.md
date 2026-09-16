# 02 — Software Requirements Specification (SRS)
## Sistem Absensi Biometrik Sekolah

Format: formal SRS. Setiap requirement memiliki ID unik dan dapat diverifikasi (testable).

---

## 1. Introduction

Dokumen ini menjabarkan kebutuhan fungsional dan non-fungsional Sistem Absensi Biometrik secara formal, sebagai turunan dari 01-PRD.md, dan menjadi acuan untuk desain teknis (03-SAD.md dst).

## 2. Purpose

Memberikan spesifikasi kebutuhan yang jelas, terukur, dan dapat diverifikasi bagi tim pengembang (frontend, backend, database, security, QA, DevOps) agar implementasi konsisten dengan tujuan produk.

## 3. Scope

Mencakup: autentikasi & otorisasi, manajemen data master (siswa/kelas/jurusan/guru), pipeline presensi biometrik, dashboard & laporan, sinkronisasi data eksternal, keamanan, dan observability. Tidak mencakup modul akademik/keuangan (lihat Non-Goals PRD).

## 4. Definitions

- **Presensi**: pencatatan kehadiran siswa berbasis hasil face matching.
- **Liveness check**: proses memastikan wajah yang dipindai adalah manusia hidup, bukan foto/video/spoof.
- **Embedding biometrik**: representasi numerik wajah hasil ekstraksi fitur, digunakan untuk matching, bukan gambar wajah itu sendiri.
- **External ID**: identifier record yang berasal dari sistem sekolah eksternal.
- **Idempotent**: operasi yang jika dijalankan berulang dengan input sama menghasilkan efek akhir yang sama (tidak duplikat).
- **Source of Truth**: sumber data otoritatif — dalam sistem ini adalah PostgreSQL.

## 5. System Overview

Sistem terdiri dari frontend Next.js (dashboard admin/operator), backend API Next.js/Node.js (stateless, horizontal scalable), PostgreSQL sebagai source of truth, Redis untuk cache & rate limiting, queue (BullMQ) + worker untuk pemrosesan asinkron, object storage untuk file/blob, dan kanal realtime (WebSocket/SSE) untuk dashboard.

## 6. Actors

- SUPER_ADMIN, ADMIN, OPERATOR, WALI_KELAS, VIEWER (lihat 01-PRD.md §Roles).
- Kamera/Edge Device (aktor sistem, mengirim hasil recognition ke API).
- External School System (aktor sistem, sumber data sinkronisasi).
- Sync Worker, Notification Worker, Report Worker (aktor sistem internal).

## 7. Functional Requirements

### Autentikasi & Otorisasi
- **FR-AUTH-001**: Sistem harus menyediakan login menggunakan email/username dan password, mengembalikan session/token yang valid untuk request berikutnya.
- **FR-AUTH-002**: Sistem harus menolak login setelah N percobaan gagal berturut-turut dalam jendela waktu tertentu (rate limited), dan mencatat percobaan gagal di audit log.
- **FR-AUTH-003**: Sistem harus menyediakan endpoint logout yang menginvalidasi session/token aktif.
- **FR-AUTH-004**: Sistem harus menyediakan endpoint untuk mengambil profil user yang sedang login (`/api/auth/me`).
- **FR-AUTH-005**: Sistem harus menerapkan RBAC — setiap endpoint memiliki daftar role yang diizinkan, dan request dari role tidak sesuai harus ditolak dengan HTTP 403.

### Manajemen Siswa
- **FR-STUDENT-001**: Sistem harus dapat membuat, membaca, memperbarui, dan menghapus (soft delete) data siswa, termasuk NISN, nama, kelas, jurusan, dan status aktif.
- **FR-STUDENT-002**: Sistem harus mencegah NISN duplikat dalam data aktif.
- **FR-STUDENT-003**: Sistem harus mendukung pencarian siswa berdasarkan nama atau NISN dengan hasil paginated.
- **FR-STUDENT-004**: Sistem harus mendukung filter daftar siswa berdasarkan kelas dan jurusan.

### Enrolment Biometrik
- **FR-ENROLL-001**: Sistem harus dapat menerima upload foto softfile satu siswa (manual) untuk keperluan enrolment biometrik.
- **FR-ENROLL-002**: Sistem harus dapat menerima batch upload foto softfile untuk banyak siswa sekaligus (mis. saat sinkronisasi data siswa awal).
- **FR-ENROLL-003**: Sistem harus memvalidasi kualitas foto (tepat satu wajah terdeteksi, resolusi minimum, tidak blur) sebelum menghasilkan embedding; foto yang tidak lolos validasi ditolak dan dicatat sebagai kegagalan enrolment.
- **FR-ENROLL-004**: Sistem harus menghasilkan embedding dari foto yang lolos validasi dan menyimpannya ke `biometric_profiles`.
- **FR-ENROLL-005**: Sistem harus menghapus permanen foto softfile sumber segera setelah proses enrolment selesai — baik berhasil maupun gagal — tidak ada retensi foto enrolment dalam kondisi apa pun (NFR-SEC-004).
- **FR-ENROLL-006**: Sistem harus mencatat riwayat enrolment (waktu, actor, hasil, sumber: manual/batch) di audit log tanpa menyertakan foto atau embedding di dalamnya.

### Manajemen Kelas & Jurusan
- **FR-CLASS-001**: Sistem harus dapat membuat, membaca, memperbarui data kelas, termasuk relasi ke jurusan dan wali kelas.
- **FR-MAJOR-001**: Sistem harus dapat membuat dan membaca data jurusan/kejuruan.

### Kamera & Kios (Opsional)
- **FR-CAMERA-001**: Sistem harus dapat mendaftarkan kamera/kios dengan identitas lokasi dan status aktif/nonaktif — jalur ini OPSIONAL, hanya relevan jika sekolah menggunakan perangkat bersama tepercaya (bukan jalur presensi utama, lihat FR-CHECKIN-001..006 di bawah).
- **FR-CAMERA-002**: Sistem harus mencatat status terakhir kamera (online/offline, FPS, resolusi) untuk keperluan monitoring, jika kamera/kios dipakai.
- **FR-ATTENDANCE-001**: Sistem harus dapat menerima hasil recognition dari kamera/kios tepercaya (jalur opsional, terautentikasi API key perangkat) dan menyimpannya sebagai catatan kehadiran dengan channel `KIOSK`.

### Presensi Mandiri via HP Siswa (Jalur Utama)
- **FR-CHECKIN-001**: Sistem harus menyediakan endpoint publik (tanpa autentikasi device/password) yang menerima NISN + foto wajah dari HP siswa.
- **FR-CHECKIN-002**: Sistem TIDAK BOLEH mempercayai skor kecocokan atau hasil liveness yang dikirim dari klien (HP siswa) — kedua nilai itu WAJIB dihitung ulang di server (via Face Service) dari foto mentah yang dikirim.
- **FR-CHECKIN-003**: Sistem harus melakukan verifikasi 1:1 (bukan pencarian 1:N) — foto live capture dibandingkan HANYA dengan template biometrik siswa yang NISN-nya diketik, bukan dicocokkan ke seluruh basis siswa.
- **FR-CHECKIN-004**: Sistem harus menolak presensi jika liveness gagal ATAU similarity di bawah threshold (90%, NFR-ACC-001) — pesan error generik ke klien (tidak membedakan "NISN tidak ditemukan" vs "wajah tidak cocok", demi anti-enumeration).
- **FR-CHECKIN-005**: Foto mentah yang dikirim untuk check-in TIDAK BOLEH disimpan permanen maupun sementara di Object Storage — diproses di memori server/Face Service, dibuang setelah request selesai (lebih ketat dari kebijakan enrolment).
- **FR-CHECKIN-006**: Sistem harus menerapkan rate limiting per NISN dan per IP (bukan autentikasi password) sebagai pertahanan utama terhadap penyalahgunaan endpoint check-in, karena tidak ada secret yang dicek.

### Aturan Presensi Bersama (berlaku baik channel STUDENT_PHONE maupun KIOSK)
- **FR-ATTENDANCE-002**: Sistem harus menolak/mengkarantina hasil recognition dengan skor kecocokan di bawah threshold yang dikonfigurasi (default **90%**), dan tidak mencatatnya sebagai kehadiran valid. Nilai ini disimpan sebagai default di `attendance_settings.match_threshold` dan dapat dioverride per kelas bila diperlukan.
- **FR-ATTENDANCE-003**: Sistem harus mencegah pencatatan kehadiran duplikat untuk siswa yang sama dalam jendela waktu tertentu (mis. 5 menit) pada sesi yang sama.
- **FR-ATTENDANCE-004**: Sistem harus menentukan status kehadiran (tepat waktu/terlambat) berdasarkan jadwal yang dikonfigurasi per sekolah/kelas.
- **FR-ATTENDANCE-005**: Sistem harus menyediakan endpoint untuk mengambil kehadiran hari ini dan kehadiran terbaru (untuk dashboard).

### Dashboard & Realtime
- **FR-DASH-001**: Sistem harus menyediakan statistik agregat kehadiran harian (total siswa, hadir tepat waktu, terlambat, izin/sakit) per kelas atau keseluruhan.
- **FR-SYNC-REALTIME-001**: Sistem harus mengirimkan event kehadiran baru ke klien dashboard yang terhubung dalam waktu ≤ 2 detik dari saat data tersimpan, melalui WebSocket atau SSE.

### Laporan
- **FR-REPORT-001**: Sistem harus dapat mengekspor log absensi terfilter (rentang tanggal, kelas) ke format PDF secara asinkron melalui queue, dan menyediakan tautan unduh setelah selesai.

### Sinkronisasi Eksternal
- **FR-SYNC-001**: Sistem harus dapat melakukan sinkronisasi penuh (full sync) data siswa/kelas/jurusan/guru dari sistem eksternal secara manual (dipicu admin) maupun terjadwal.
- **FR-SYNC-002**: Sistem harus dapat melakukan sinkronisasi incremental berdasarkan perubahan sejak `last_synced_at`.
- **FR-SYNC-003**: Sistem harus melakukan upsert berbasis `external_id`, bukan menghapus data lokal yang tidak muncul sementara dari sumber eksternal.
- **FR-SYNC-004**: Sistem harus mencatat setiap sesi sinkronisasi (status, jumlah record diproses, gagal) dan setiap record gagal secara individual untuk retry manual.
- **FR-SYNC-005**: Setiap operasi sinkronisasi harus idempotent — menjalankan ulang sesi sinkronisasi yang sama tidak boleh menghasilkan duplikasi data.

### Audit
- **FR-AUDIT-001**: Sistem harus mencatat setiap operasi sensitif (create/update/delete data master, perubahan role, export data, login gagal) dengan actor, waktu, dan detail perubahan.

## 8. Non-Functional Requirements

- **NFR-PERF-001**: P95 latensi API pencatatan kehadiran (`POST /api/attendance`) harus ≤ 300ms tidak termasuk waktu pemrosesan recognition di edge.
- **NFR-PERF-002**: Dashboard harus menampilkan update kehadiran baru ke UI dalam ≤ 2 detik (lihat FR-SYNC-REALTIME-001).
- **NFR-SCALE-001**: Backend API harus stateless sehingga dapat ditambah instance (horizontal scale) tanpa perubahan kode.
- **NFR-SCALE-002**: Worker harus dapat diskalakan secara independen dari API.
- **NFR-AVAIL-001**: Kegagalan Redis tidak boleh menyebabkan pipeline pencatatan kehadiran inti berhenti total (degradasi: cache miss, bukan downtime).
- **NFR-AVAIL-002**: Downtime akibat relokasi fisik mini PC (renovasi sekolah) adalah downtime terencana yang disengaja dan dikecualikan dari perhitungan SLA uptime — dengan syarat wajib: backup ke lokasi kedua sudah terverifikasi sebelum shutdown (lihat 11-DEPLOYMENT.md §8, 12-OPERATIONS.md §5.1). Di luar periode relokasi terjadwal ini, target uptime normal (lihat NFR-AVAIL-001 dan OQ-SRS-03) tetap berlaku.
- **NFR-REL-001**: Seluruh job asinkron (queue) harus idempotent (lihat FR-SYNC-005 dan job attendance-processing).
- **NFR-SEC-001**: Data embedding biometrik tidak boleh dikirim ke response API yang dapat diakses frontend/browser dalam bentuk apa pun.
- **NFR-ACC-001**: Ambang skor kecocokan wajah (match threshold) default sistem adalah **90%** — hasil recognition dengan skor di bawah 90% tidak boleh dicatat sebagai kehadiran valid (lihat FR-ATTENDANCE-002). Nilai ini adalah keputusan produk resmi, dapat disesuaikan per kelas melalui `attendance_settings` bila kondisi lapangan (pencahayaan, kualitas kamera) memerlukan penyesuaian, dengan persetujuan admin.
- **NFR-SEC-004**: Foto softfile yang digunakan untuk enrolment biometrik harus dihapus permanen dari penyimpanan dalam ≤5 menit setelah proses enrolment selesai (berhasil atau gagal) — diverifikasi melalui job cleanup terjadwal sebagai pengaman tambahan di luar penghapusan langsung dalam alur enrolment.
- **NFR-SEC-002**: Semua endpoint API (kecuali health check) harus memerlukan autentikasi.
- **NFR-SEC-003**: Password harus disimpan menggunakan algoritma hashing yang direkomendasikan (mis. bcrypt/argon2), tidak pernah dalam bentuk plain text.
- **NFR-AUDIT-001**: Audit log tidak boleh dapat diubah/dihapus melalui API aplikasi biasa (append-only secara logis).

## 9. Interface Requirements

- Seluruh komunikasi API menggunakan REST dengan format JSON dan mengikuti kontrak di 05-API-SPEC.md.
- Kamera/edge device berkomunikasi dengan backend melalui HTTPS API yang sama, terautentikasi dengan API key per kamera (lihat 06-SECURITY-SPEC.md).
- Dashboard menggunakan WebSocket atau SSE untuk update realtime, dengan REST sebagai sumber data awal (initial load).

## 10. Data Requirements

Lihat 04-ERD.md dan 13-DATA-DICTIONARY.md untuk struktur lengkap. Data inti: users, students, classes, majors, teachers, attendance, cameras, biometric_profiles, sync_logs, audit_logs.

## 11. Security Requirements

Lihat 06-SECURITY-SPEC.md untuk detail penuh. Ringkasan wajib: RBAC ketat, biometric data terisolasi, TLS end-to-end, rate limiting, audit logging menyeluruh.

## 12. Performance Requirements

Lihat NFR-PERF-001, NFR-PERF-002. Target throughput minimum: 10 presensi/detik per instance API pada beban puncak (jam masuk sekolah) — target ini OPEN QUESTION menunggu data jumlah siswa aktual per sekolah.

## 13. Availability Requirements

Target awal (belum disepakati SLA formal dengan sekolah): 99.5% uptime pipeline presensi selama jam operasional sekolah. Maintenance terjadwal di luar jam sekolah.

## 14. Scalability Requirements

Lihat NFR-SCALE-001, NFR-SCALE-002. Arsitektur harus mendukung penambahan instance APP dan WORKER tanpa downtime (lihat 03-SAD.md).

## 15. Reliability Requirements

Lihat NFR-REL-001. Semua job queue harus punya retry dengan backoff dan dead-letter handling (lihat 09-QUEUE-WORKER-SPEC.md).

## 16. Audit Requirements

Lihat FR-AUDIT-001, NFR-AUDIT-001.

## 17. Error Handling

- Semua endpoint API harus mengembalikan struktur error konsisten: `{ "error": { "code": string, "message": string, "details"?: object } }`.
- Validasi input harus terjadi sebelum operasi database, mengembalikan HTTP 400 dengan detail field yang gagal.
- Kegagalan dependency eksternal (Redis, storage, sync source) harus ditangani dengan fallback/circuit breaker, bukan error 500 tak terkendali.

## 18. Backup & Recovery

PostgreSQL harus memiliki backup terjadwal (lihat 12-OPERATIONS.md) dengan RPO dan RTO yang didefinisikan bersama sekolah (OPEN QUESTION nilai pastinya). Object storage menggunakan versioning/lifecycle policy pada bucket backup.

## 19. Acceptance Criteria

Setiap FR/NFR di atas dianggap diterima jika memiliki test case yang lulus di 10-TEST-PLAN.md dan tertaut di 14-TRACEABILITY.md.

## OPEN QUESTIONS

- ~~OQ-SRS-01: Threshold skor kecocokan wajah dan definisi "liveness passed" bergantung pada vendor engine~~ — **RESOLVED**: InsightFace + MiniFASNet dipilih (self-hosted, open-source). Threshold 90% tetap berlaku (NFR-ACC-001). Definisi "liveness passed" = output model MiniFASNet ≥ 0.5 pada kelas "live" — TAPI belum divalidasi dengan foto asli (lihat `face-service/README.md`), jadi nilai threshold liveness ini masih bisa disesuaikan setelah pengujian nyata.
- OQ-SRS-02: Jendela waktu deduplikasi presensi (FR-ATTENDANCE-003) — diasumsikan 5 menit, perlu konfirmasi kebijakan sekolah.
- OQ-SRS-03: SLA uptime resmi (NFR-AVAIL-001) dan RPO/RTO backup belum disepakati secara kontraktual.
