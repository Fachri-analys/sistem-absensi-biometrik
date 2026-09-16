# Dokumentasi — Sistem Absensi Biometrik Sekolah

Dokumentasi ini adalah **source of truth** — tapi sejak implementasi kode dimulai, sejumlah keputusan penting dibuat/berubah SAAT ngoding (bukan didesain dulu di dokumen baru dikerjakan). Dokumen-dokumen di folder ini sudah **disinkronkan ulang** mengikuti kode yang benar-benar ada di `src/`, `worker/`, dan `face-service/` — bukan sebaliknya. Kalau ada perbedaan antara dokumen dan kode di masa depan, KODE yang jadi acuan realitas, tapi dokumen ini harus selalu diperbarui secepatnya supaya tetap dipercaya.

---

## Perubahan Besar Sejak Draf Awal (Baca Ini Dulu)

Tiga keputusan berikut mengubah banyak bagian dokumentasi awal secara mendasar — dijelaskan di sini sebagai satu tempat rujukan, detail teknisnya tersebar di dokumen masing-masing:

1. **Presensi bukan via kamera gerbang, tapi via HP pribadi siswa.** Draf awal (dan referensi UI dashboard) mengasumsikan kamera fisik di gerbang, dipantau operator. Realitasnya: siswa buka website di HP masing-masing, ketik NISN, kamera HP aktif, foto dikirim ke server. Kamera/kios fisik TETAP didukung di skema (`channel: KIOSK`) tapi sebagai jalur OPSIONAL, bukan utama. Ini mengubah trust model secara fundamental (lihat 03-SAD.md §6) — HP siswa adalah perangkat TIDAK TEPERCAYA, beda dengan kamera device yang dulu diasumsikan tepercaya.
2. **Vendor face recognition sudah dipilih & diimplementasikan**: InsightFace (buffalo_l) + MiniFASNet ONNX, self-hosted, 100% open-source (Recognito Vision — opsi komersial yang butuh Windows Server — dieliminasi karena butuh lisensi berbayar). Jalan sebagai microservice Python terpisah (`face-service/`), dipanggil APP via HTTP internal.
3. **Deployment nyata**: dua server (cPanel untuk APP, server terpisah untuk Face Service) — bukan lagi asumsi generik "cloud/on-prem". Lihat 11-DEPLOYMENT.md §10 dan 15-INFRASTRUCTURE-SPEC.md §5.

## Urutan Membaca yang Disarankan

1. **01-PRD.md** — Mulai di sini. Memahami masalah, tujuan produk, role, dan cakupan MVP/Phase 2/3.
2. **02-SRS.md** — Kebutuhan fungsional & non-fungsional formal (ID FR-xxx/NFR-xxx), termasuk FR-CHECKIN-* (alur utama, presensi HP siswa).
3. **03-SAD.md** — Arsitektur sistem: komponen (termasuk Face Service), alur data, trust boundary (WAJIB dibaca — berubah signifikan), failure mode, strategi scaling.
4. **04-ERD.md** — Skema database PostgreSQL (source of truth data) — `attendance.channel`, `attendance.camera_id` nullable.
5. **13-DATA-DICTIONARY.md** — Detail setiap kolom & klasifikasi sensitivitas data.
6. **05-API-SPEC.md** — Kontrak REST API — `POST /api/attendance/checkin` adalah endpoint UTAMA.
7. **06-SECURITY-SPEC.md** — WAJIB dibaca sebelum implementasi apa pun yang menyentuh data biometrik/PII. Model autentikasi NISN-tanpa-password dijelaskan di sini.
8. **07-SYNC-SPEC.md** — Sinkronisasi data dengan sistem sekolah eksternal (masih OPEN QUESTION).
9. **08-CACHE-SPEC.md**, **09-QUEUE-WORKER-SPEC.md**, **15-INFRASTRUCTURE-SPEC.md** — Lapisan pendukung (Redis, queue/worker, Face Service, object storage & infra dua-server).
10. **10-TEST-PLAN.md** (§4 penting — status implementasi aktual, bukan cuma rencana), **14-TRACEABILITY.md**.
11. **11-DEPLOYMENT.md** (§10 — topologi cPanel + Face Service), **12-OPERATIONS.md**.
12. **16-IMPLEMENTATION-ROADMAP.md** — roadmap 15 fase asli (sebagian sudah dikerjakan di luar urutan — lihat kode sumber untuk status riil).

## Kode Sumber (di luar folder docs/)

- `src/`, `worker/` — APP Next.js + Worker (TypeScript), sesuai arsitektur di 03-SAD.md.
- `face-service/` — microservice Python (InsightFace + MiniFASNet). **Baca `face-service/README.md`** untuk apa yang sudah diverifikasi jalan vs yang belum (liveness detection BELUM diuji dengan model/foto asli).
- `prisma/schema.prisma` — sumber kebenaran skema database yang SEBENARNYA (04-ERD.md/13-DATA-DICTIONARY.md diusahakan selalu sinkron, tapi kalau ragu, schema.prisma yang benar).
- `src/lib/__tests__/` — unit test yang benar-benar dijalankan (lihat 10-TEST-PLAN.md §4).

## Architecture Overview

APP Next.js (stateless) di-hosting di server cPanel, memanggil **Face Service** (Python, server terpisah) untuk semua operasi biometrik (liveness, embedding, similarity 1:1) via HTTP internal — APP sendiri tidak pernah menyimpan/melihat vektor wajah mentah. PostgreSQL adalah **satu-satunya source of truth**. Redis menangani cache, rate limiting (termasuk pertahanan utama untuk endpoint check-in publik), dan menjadi backend BullMQ. Worker menangani pekerjaan asinkron (laporan, sinkronisasi, enrolment) — TAPI perbandingan wajah saat check-in dilakukan SINKRON (APP↔Face Service langsung), bukan lewat queue, karena siswa butuh jawaban instan. Object Storage menyimpan foto tampilan siswa dan foto enrolment SEMENTARA — foto check-in harian TIDAK PERNAH ditulis ke storage sama sekali. Lihat diagram lengkap di 03-SAD.md.

## Development Roadmap

Lihat **16-IMPLEMENTATION-ROADMAP.md** untuk rencana 15 fase asli. Catatan: implementasi aktual tidak persis mengikuti urutan fase itu (mis. Face Service/biometric integration dikerjakan lebih awal dari rencana Phase 8) — kode sumber adalah rujukan status riil, roadmap ini rujukan rencana awal.

## Hubungan Antar Dokumen

```
01-PRD  ──▶ 02-SRS ──▶ 03-SAD ──▶ 04-ERD ──▶ 13-DATA-DICTIONARY
                │                     │
                ▼                     ▼
          05-API-SPEC ◀───────────────┘
                │
    ┌───────────┼────────────┬─────────────────┬───────────────┐
    ▼           ▼            ▼                 ▼               ▼
06-SECURITY  07-SYNC   08-CACHE/09-QUEUE   15-INFRASTRUCTURE   (semua di atas)
    │           │            │                 │               │
    └───────────┴────────────┴─────────────────┴───────────────┘
                             ▼
                     10-TEST-PLAN ──▶ 14-TRACEABILITY
                             │
                             ▼
              11-DEPLOYMENT ──▶ 12-OPERATIONS
                             │
                             ▼
                16-IMPLEMENTATION-ROADMAP
```

Setiap requirement penting di 02-SRS.md harus dapat ditelusuri hingga test case di 10-TEST-PLAN.md melalui 14-TRACEABILITY.md (aturan #22 pada instruksi asal proyek).

## Keputusan Arsitektur Utama

0. **Enrolment biometrik via foto softfile dari rapor** (bukan live capture) — mendukung upload manual per siswa maupun batch. Foto sumber dihapus permanen segera setelah embedding berhasil dibuat, tanpa retensi dalam kondisi apa pun (FR-ENROLL-001..006, NFR-SEC-004, 06-SECURITY-SPEC.md).
0.1. **Ambang skor kecocokan wajah (match threshold) ditetapkan 90%** (NFR-ACC-001, FR-ATTENDANCE-002).
0.2. **Presensi mandiri via HP siswa (channel STUDENT_PHONE) adalah jalur UTAMA** — siswa mengetik NISN (tanpa password), kamera HP aktif, foto dikirim ke server. Verifikasi 1:1 (bukan 1:N) karena identitas sudah diklaim lewat NISN. Kamera/kios fisik (`channel: KIOSK`) tetap didukung sebagai jalur OPSIONAL untuk perangkat tepercaya sekolah. Lihat FR-CHECKIN-001..006, 03-SAD.md §6.
0.3. **Autentikasi siswa TANPA PASSWORD** — NISN sebagai identitas yang diklaim, wajah sebagai satu-satunya bukti. Pertahanan terhadap penyalahgunaan adalah rate limiting (per NISN + per IP), BUKAN secret yang bisa dibobol — karena endpoint check-in memang publik dan tidak bisa memasang credential rahasia di kode client-side. Keputusan disengaja, bukan celah (06-SECURITY-SPEC.md §Authentication).
0.4. **Face recognition self-hosted, open-source, tanpa lisensi**: InsightFace (buffalo_l) + MiniFASNet ONNX sebagai microservice Python terpisah (`face-service/`). Embedding dienkripsi AES-256-GCM oleh Face Service sebelum dikembalikan ke APP — APP tidak pernah punya kunci dekripsinya (resolusi OQ-SEC-01/OQ-PRD-01, lihat 06-SECURITY-SPEC.md).
0.5. **Foto check-in TIDAK PERNAH ditulis ke Object Storage** (lebih ketat dari foto enrolment yang sempat tersimpan sementara) — diproses di memori APP/Face Service selama satu request, dibuang setelah selesai (FR-CHECKIN-005).
0.6. **Batas "hari" untuk presensi dihitung berdasarkan kalender WIB, bukan UTC** — bug nyata yang ditemukan & diperbaiki saat implementasi: karena sekolah masuk ~06:30-07:00 WIB (sebelum titik ganti hari UTC di jam 07:00 WIB), perhitungan naif berbasis UTC akan salah menghitung presensi pagi sebagai "hari kemarin". Lihat `src/lib/school-time.ts`.
0.7. **Unique constraint `(studentId, attendanceDate)` di level database** — bukan hanya pengecekan aplikasi — untuk mencegah race condition saat banyak siswa check-in bersamaan (TC-ATT-003). Ditemukan sebagai celah nyata saat audit kode, diperbaiki dengan constraint DB + penanganan error P2002.
0.8. **Deployment dua server**: cPanel (Linux) untuk APP, server terpisah untuk Face Service (Linux, tidak butuh GPU/Windows) — lihat 11-DEPLOYMENT.md §10, 15-INFRASTRUCTURE-SPEC.md §5.
0.9. **Infrastruktur bisa berupa mini PC on-premise yang portable** (kalau salah satu dari dua server di atas memang begitu) — kewajiban backup ke lokasi kedua dan playbook relokasi tetap berlaku (11-DEPLOYMENT.md §6–8, 12-OPERATIONS.md §5–5.1, NFR-AVAIL-002).
1. **PostgreSQL sebagai satu-satunya source of truth.** Redis, queue, dan object storage bersifat pendukung.
2. **Backend stateless** agar dapat di-scale horizontal tanpa perubahan kode.
3. **Data biometrik terisolasi ketat** — dienkripsi AES-256-GCM, tidak pernah dikirim ke frontend, tidak pernah di-log, tidak pernah di-cache, hanya Face Service yang bisa mendekripsi.
4. **Provider-agnostic melalui abstraction layer** untuk Object Storage, CDN, Secret Manager, DAN engine face recognition (`FaceRecognitionEngine` interface — vendor lain bisa dipasang tanpa mengubah kode APP).
5. **Idempotency sebagai prinsip wajib** untuk seluruh operasi asinkron (queue) dan sinkronisasi eksternal.
6. **Tidak menghapus data lokal secara otomatis** akibat ketidakhadiran sementara di sistem eksternal saat sinkronisasi.
7. **UI/UX referensi HTML tidak boleh dirusak** — tapi dipahami ulang sebagai kontrak visual DASHBOARD ADMIN/OPERATOR, bukan tampilan yang dilihat siswa (siswa hanya melihat halaman check-in sederhana).

## Keputusan Penomoran Dokumen

Instruksi asal proyek meminta dua dokumen berbeda dengan nama file yang sama: `08-INFRASTRUCTURE-SPEC.md` bertabrakan dengan `08-CACHE-SPEC.md`. Infrastructure Spec diberi nomor **15**. Roadmap implementasi ditulis sebagai `16-IMPLEMENTATION-ROADMAP.md`. Seluruh nama file lain mengikuti persis path yang diminta pada instruksi asal.

## Open Questions (Ringkasan Lintas Dokumen)

Setiap dokumen mencantumkan OPEN QUESTIONS-nya sendiri di bagian akhir. **Resolved sejak draf awal:**
- ~~Vendor/engine face recognition~~ → InsightFace + MiniFASNet, self-hosted (OQ-PRD-01, OQ-SAD-01, OQ-SRS-01, OQ-SEC-01 — semua resolved).
- ~~Apakah recognition di edge atau server~~ → selalu di server/Face Service (OQ-SAD-01).

**Yang paling kritikal dan masih terbuka:**
- **Liveness detection belum divalidasi dengan foto/model asli** (OQ-SEC-04, lihat `face-service/README.md`) — ini BLOCKER untuk go-live, bukan sekadar catatan. Endpoint fail-closed sampai model terpasang, tapi akurasi anti-spoof-nya sendiri belum dibuktikan.
- **Race condition check-in bersamaan belum diuji dengan beban sungguhan** (OQ-TEST-02) — perbaikan sudah ada di kode (unique constraint DB), tapi belum dibuktikan dengan test konkurensi nyata.
- **Jenis paket cPanel** (shared vs VPS root) belum dikonfirmasi (OQ-INFRA-03, OQ-DEPLOY-02) — menentukan apakah Worker/Redis/PostgreSQL bisa co-locate dengan APP atau wajib di server ke-2.
- **Jaringan aman antar dua server** (APP↔Face Service) belum ditentukan mekanismenya (OQ-SAD-03, OQ-INFRA-04).
- **Struktur sistem sekolah eksternal** (Dapodik/SIS internal) belum diketahui (OQ-PRD-02, OQ-SYNC-01).
- **Kebijakan retensi data biometrik/PII** resmi dari sekolah/yayasan belum ada (OQ-SEC-02).
- **NISN sebagai identitas tanpa password** — kebijakan sekolah soal ini sebaiknya dikonfirmasi eksplisit, bukan diasumsikan (OQ-PRD-05, OQ-SEC-05).
- **SLA uptime, RPO/RTO backup** belum disepakati secara kontraktual (OQ-SRS-03, OQ-OPS-02).

## Keputusan yang Masih Harus Dibuat (Sebelum Go-Live)

1. **Uji liveness detection dengan foto asli vs foto spoof (cetak/layar HP)** — pasang model sesuai `face-service/models/README.md`, verifikasi akurasinya, SEBELUM sistem dipakai siswa sungguhan. Ini prioritas tertinggi yang tersisa.
2. **Uji race condition check-in bersamaan** dengan beban sungguhan (banyak request paralel untuk siswa yang sama) — buktikan unique constraint DB benar-benar mencegah duplikat.
3. Konfirmasi jenis paket cPanel (shared/VPS) untuk memastikan Worker/Redis/PostgreSQL bisa berjalan sesuai rencana.
4. Tentukan mekanisme jaringan aman antara server APP (cPanel) dan server Face Service (VPN/TLS/IP whitelist).
5. Konfirmasi dengan sekolah: apakah NISN boleh dipakai sebagai identitas check-in tanpa password tambahan.
6. Menyepakati kebijakan retensi data (attendance log, foto, embedding biometrik) dengan pihak sekolah/yayasan.
7. Menentukan cakupan absensi pulang (check-out) apakah masuk MVP atau Phase 2.
8. Mendapatkan detail teknis sistem sekolah eksternal untuk mendesain Sync Adapter konkret.
9. Menyepakati SLA uptime dan target RPO/RTO backup secara formal dengan sekolah.

---

*Dokumen ini dan seluruh dokumen di folder `docs/` diusahakan selalu sinkron dengan kode sumber di `src/`, `worker/`, `face-service/`. Perubahan pada salah satunya (kode atau dokumen) sebaiknya diikuti pembaruan yang lain secepatnya.*
