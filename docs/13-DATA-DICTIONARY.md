# 13 — Data Dictionary
## Sistem Absensi Biometrik Sekolah

Klasifikasi sensitivitas: **PUBLIC**, **INTERNAL**, **CONFIDENTIAL**, **SENSITIVE**, **BIOMETRIC**.

---

## Table: users

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| email | varchar | no | - | Email login | User input | CONFIDENTIAL | unique index |
| password_hash | varchar | no | - | Hash password, tidak pernah di-expose | System | SENSITIVE | - |
| full_name | varchar | no | - | Nama lengkap user | User input | INTERNAL | - |
| role_id | uuid | no | - | FK ke roles | System | INTERNAL | index |
| homeroom_class_id | uuid | yes | null | FK ke classes, untuk WALI_KELAS | Admin input | INTERNAL | index |
| is_active | boolean | no | true | Status aktif akun | System | INTERNAL | - |
| last_login_at | timestamptz | yes | null | Waktu login terakhir | System | INTERNAL | - |
| created_at | timestamptz | no | now() | Waktu dibuat | System | INTERNAL | - |
| updated_at | timestamptz | no | now() | Waktu diperbarui | System | INTERNAL | - |
| deleted_at | timestamptz | yes | null | Soft delete | System | INTERNAL | index (partial) |

## Table: roles

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | PUBLIC | PK |
| code | varchar | no | - | SUPER_ADMIN/ADMIN/OPERATOR/WALI_KELAS/VIEWER | System | PUBLIC | unique index |
| description | text | yes | null | Deskripsi role | Admin input | PUBLIC | - |

## Table: majors

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | PUBLIC | PK |
| external_id | varchar | yes | null | ID dari sistem eksternal | External sync | INTERNAL | unique index (partial) |
| name | varchar | no | - | Nama jurusan | Admin/Sync | PUBLIC | - |
| code | varchar | no | - | Kode jurusan | Admin/Sync | PUBLIC | unique index |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |
| deleted_at | timestamptz | yes | null | Soft delete | System | INTERNAL | index (partial) |

## Table: classes

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | PUBLIC | PK |
| external_id | varchar | yes | null | ID dari sistem eksternal | External sync | INTERNAL | unique index (partial) |
| name | varchar | no | - | Nama kelas, mis. "XII RPL 1" | Admin/Sync | PUBLIC | - |
| major_id | uuid | no | - | FK ke majors | Admin/Sync | INTERNAL | index |
| homeroom_teacher_id | uuid | yes | null | FK ke teachers | Admin/Sync | INTERNAL | index |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |
| deleted_at | timestamptz | yes | null | Soft delete | System | INTERNAL | index (partial) |

## Table: teachers

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| external_id | varchar | yes | null | ID dari sistem eksternal | External sync | INTERNAL | unique index (partial) |
| full_name | varchar | no | - | Nama guru | Admin/Sync | INTERNAL | - |
| nip | varchar | yes | null | Nomor induk pegawai | Admin/Sync | CONFIDENTIAL | unique index (partial) |
| user_id | uuid | yes | null | FK ke users bila guru punya akun login | Admin | INTERNAL | index |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |
| deleted_at | timestamptz | yes | null | Soft delete | System | INTERNAL | index (partial) |

## Table: students

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| external_id | varchar | yes | null | ID dari sistem eksternal | External sync | INTERNAL | unique index (partial) |
| nisn | varchar | no | - | Nomor Induk Siswa Nasional | Admin/Sync | CONFIDENTIAL | unique index |
| full_name | varchar | no | - | Nama siswa | Admin/Sync | CONFIDENTIAL | - |
| class_id | uuid | no | - | FK ke classes | Admin/Sync | INTERNAL | index |
| gender | varchar | yes | null | Jenis kelamin | Admin/Sync | CONFIDENTIAL | - |
| photo_object_key | varchar | yes | null | Referensi foto di Object Storage | Admin upload | CONFIDENTIAL | - |
| is_active | boolean | no | true | Status aktif siswa | Admin/Sync | INTERNAL | - |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |
| deleted_at | timestamptz | yes | null | Soft delete | System | INTERNAL | index (partial) |

## Table: biometric_profiles

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | BIOMETRIC | PK |
| student_id | uuid | no | - | FK ke students, 1:1 | Enrolment process | BIOMETRIC | unique index |
| embedding_ref | varchar | no | - | Referensi ke embedding terenkripsi | Face processing | BIOMETRIC | - |
| embedding_version | varchar | no | - | Versi model recognition | Face processing | INTERNAL | - |
| source_type | varchar | no | - | MANUAL_UPLOAD/BATCH_UPLOAD, asal foto enrolment | Enrolment process | INTERNAL | - |
| enrolled_at | timestamptz | no | now() | Waktu pendaftaran wajah | System | BIOMETRIC | - |
| is_active | boolean | no | true | Status aktif profil | System | BIOMETRIC | - |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |

## Table: cameras

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| name | varchar | no | - | Nama kamera | Admin input | INTERNAL | - |
| location | varchar | no | - | Lokasi fisik | Admin input | INTERNAL | - |
| api_key_hash | varchar | no | - | Hash API key kamera | System | SENSITIVE | - |
| status | varchar | no | 'OFFLINE' | ONLINE/OFFLINE | System | INTERNAL | index |
| last_seen_at | timestamptz | yes | null | Waktu heartbeat terakhir | System | INTERNAL | - |
| resolution | varchar | yes | null | Resolusi kamera | Admin/Camera report | INTERNAL | - |
| fps | int | yes | null | Frame per second | Admin/Camera report | INTERNAL | - |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |
| deleted_at | timestamptz | yes | null | Soft delete | System | INTERNAL | index (partial) |

## Table: attendance_settings

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| class_id | uuid | yes | null | FK ke classes, null = default sekolah | Admin input | INTERNAL | index |
| check_in_start_minutes | int | no | - | Menit sejak tengah malam WIB — jam mulai presensi (bukan kolom TIME, lihat catatan timezone di schema.prisma) | Admin input | INTERNAL | - |
| check_in_late_after_minutes | int | no | - | Menit sejak tengah malam WIB — batas waktu dianggap terlambat | Admin input | INTERNAL | - |
| match_threshold | numeric | no | 0.90 | Ambang skor kecocokan wajah, default 90% (NFR-ACC-001) | Admin input | INTERNAL | - |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |

## Table: attendance

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | CONFIDENTIAL | PK |
| student_id | uuid | no | - | FK ke students | Face Service/API | CONFIDENTIAL | index (composite dgn recorded_at) |
| camera_id | uuid | **yes** | null | FK ke cameras — null untuk channel STUDENT_PHONE (jalur utama), terisi hanya untuk KIOSK | Kios/API (opsional) | INTERNAL | index (composite dgn recorded_at) |
| channel | varchar | no | STUDENT_PHONE | STUDENT_PHONE (jalur utama, HP siswa) / KIOSK (opsional) | System | INTERNAL | - |
| match_score | numeric | no | - | Skor kecocokan wajah, dihitung oleh Face Service | Face Service | INTERNAL | - |
| liveness_passed | boolean | no | - | Hasil liveness check dari Face Service | Face Service | INTERNAL | - |
| status | varchar | no | - | ON_TIME/LATE/MANUAL | System (calculated) | INTERNAL | index |
| recorded_at | timestamptz | no | - | Waktu kejadian presensi | System | CONFIDENTIAL | index |
| attendance_date | date | no | - | Tanggal kalender WIB (bukan UTC), dipakai unique constraint | System (calculated) | INTERNAL | unique (composite dgn student_id) |
| created_at | timestamptz | no | now() | Waktu tersimpan sistem | System | INTERNAL | - |
| idempotency_key | varchar | no | - | Mencegah double-submit; server-generated untuk STUDENT_PHONE, client-provided untuk KIOSK | System/Kios | INTERNAL | unique |

## Table: sync_logs

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| entity_type | varchar | no | - | students/classes/majors/teachers | System | INTERNAL | index |
| sync_type | varchar | no | - | FULL/INCREMENTAL | System | INTERNAL | - |
| status | varchar | no | 'RUNNING' | RUNNING/SUCCESS/PARTIAL/FAILED | System | INTERNAL | index |
| started_at | timestamptz | no | now() | Waktu mulai | System | INTERNAL | - |
| finished_at | timestamptz | yes | null | Waktu selesai | System | INTERNAL | - |
| total_records | int | no | 0 | Total record diproses | System | INTERNAL | - |
| success_count | int | no | 0 | Jumlah sukses | System | INTERNAL | - |
| failed_count | int | no | 0 | Jumlah gagal | System | INTERNAL | - |

## Table: sync_errors

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| sync_log_id | uuid | no | - | FK ke sync_logs | System | INTERNAL | index |
| external_id | varchar | no | - | ID record sumber yang gagal | External sync | INTERNAL | - |
| error_message | text | no | - | Pesan error | System | INTERNAL | - |
| payload_snapshot | jsonb | yes | null | Snapshot payload gagal | External sync | CONFIDENTIAL | - |
| retried | boolean | no | false | Status sudah di-retry | System | INTERNAL | - |
| created_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |

## Table: audit_logs

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| actor_user_id | uuid | yes | null | FK ke users, null = sistem | System | INTERNAL | index |
| action | varchar | no | - | Jenis aksi, mis. STUDENT_UPDATE | System | INTERNAL | - |
| entity_type | varchar | no | - | Tipe entity terkait | System | INTERNAL | index (composite) |
| entity_id | varchar | no | - | ID entity terkait | System | INTERNAL | index (composite) |
| before_snapshot | jsonb | yes | null | State sebelum perubahan (tanpa data biometrik) | System | CONFIDENTIAL | - |
| after_snapshot | jsonb | yes | null | State sesudah perubahan (tanpa data biometrik) | System | CONFIDENTIAL | - |
| ip_address | varchar | yes | null | IP actor | System | CONFIDENTIAL | - |
| created_at | timestamptz | no | now() | Timestamp | System | INTERNAL | index |

## Table: reports

| Column | Type | Nullable | Default | Description | Source | Classification | Indexing |
|---|---|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Primary key | System | INTERNAL | PK |
| requested_by | uuid | no | - | FK ke users | System | INTERNAL | index |
| type | varchar | no | - | Jenis laporan | User input | INTERNAL | - |
| filter_params | jsonb | no | - | Parameter filter laporan | User input | INTERNAL | - |
| status | varchar | no | 'PENDING' | PENDING/PROCESSING/DONE/FAILED | System | INTERNAL | index |
| object_key | varchar | yes | null | Lokasi file hasil di Object Storage | System | CONFIDENTIAL | - |
| expires_at | timestamptz | yes | null | Masa berlaku akses file | System | INTERNAL | - |
| created_at / updated_at | timestamptz | no | now() | Timestamp | System | INTERNAL | - |
