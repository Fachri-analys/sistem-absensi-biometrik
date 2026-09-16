# 06 — Security Specification
## Sistem Absensi Biometrik Sekolah

---

## Authentication
Login admin/operator/dsb berbasis email/password dengan hashing bcrypt/argon2. Token sesi (JWT dengan `jti` unik untuk mendukung revoke) dengan masa berlaku pendek. Kios/kamera tepercaya opsional memakai API key terpisah per perangkat (HMAC, bukan bcrypt — supaya bisa di-lookup langsung via index, bukan scan+compare).

**Siswa (endpoint check-in) TIDAK memakai password sama sekali** — ini keputusan yang disengaja, bukan celah yang terlewat:
- Siswa mengetik NISN (identitas semi-publik di lingkungan sekolah) untuk menunjukkan template biometrik mana yang harus dibandingkan.
- **Wajah adalah faktor pembuktian utama** — bukan "sesuatu yang diketahui" (password) tapi "sesuatu yang dimiliki secara inheren" (biometrik).
- Karena tidak ada password untuk endpoint publik ini, pertahanan terhadap penyalahgunaan bergantung pada: (a) rate limiting ketat per NISN dan per IP (FR-CHECKIN-006), dan (b) verifikasi biometrik server-side yang tidak bisa dipalsukan dari klien (lihat bagian Biometric Security di bawah).
- Implikasi: siapa pun yang tahu NISN siswa lain bisa MENCOBA presensi atas nama siswa itu, tapi TIDAK AKAN BERHASIL kecuali wajahnya juga cocok dan lolos liveness. Ini setara dengan model "username publik + biometrik sebagai satu-satunya bukti", yang secara sengaja BERBEDA dari model password tradisional.

## Authorization (RBAC)
Setiap endpoint memetakan daftar role yang diizinkan. Middleware otorisasi memverifikasi role SEBELUM logic bisnis dijalankan. WALI_KELAS mendapat scoping tambahan (hanya kelas yang diampu) yang dipaksakan di query layer server, bukan hanya disembunyikan di UI.

## Password Security
Minimum panjang & kompleksitas ditentukan kebijakan sekolah (OPEN QUESTION nilai pasti). Hash dengan bcrypt (cost factor memadai) atau argon2id. Tidak ada password di log, response API, atau audit snapshot.

## Session Security
Token disimpan di HTTP-only, Secure, SameSite cookie (untuk web dashboard) atau Authorization header (untuk klien non-browser). Token diinvalidasi saat logout dan dapat dicabut paksa oleh SUPER_ADMIN (revoke list di Redis).

## Token Security
Jika menggunakan JWT: signing key disimpan sebagai secret terkelola (bukan di kode), rotasi kunci didukung, klaim minimal (userId, role, exp), tidak menyimpan data sensitif dalam payload token.

## API Security
Validasi input ketat pada seluruh endpoint (schema validation, mis. Zod). Semua endpoint mutasi memerlukan Content-Type JSON eksplisit. Tidak ada endpoint yang mengekspos stack trace ke klien di lingkungan produksi.

## Rate Limiting
Berbasis Redis fixed-window per user (endpoint admin) dan per device (kios/kamera opsional). Untuk endpoint check-in siswa (publik, tanpa password), rate limiting BUKAN sekadar perlindungan tambahan — itu SATU-SATUNYA pertahanan terhadap spam/percobaan berulang, karena tidak ada secret yang bisa "dibobol". Dua limit dicek bersamaan: per NISN (10/10 menit) dan per IP (30/10 menit) — lihat FR-CHECKIN-006. Rate limiting untuk endpoint kritikal (attendance) menerapkan fail-open saat Redis down (lebih baik sementara tanpa rate limit daripada kehilangan data presensi), TAPI pertahanan biometrik (liveness+similarity) TETAP berjalan tanpa bergantung pada Redis sama sekali.

## CORS
Whitelist origin eksplisit (domain dashboard resmi sekolah), tidak menggunakan wildcard `*` untuk endpoint yang memerlukan kredensial.

## CSRF
Untuk endpoint berbasis cookie session, gunakan CSRF token (double submit cookie) pada operasi mutasi state via form/browser.

## XSS
Seluruh output yang dirender di UI di-escape oleh React/Next.js secara default; hindari `dangerouslySetInnerHTML` untuk data yang berasal dari input user tanpa sanitasi eksplisit.

## SQL Injection
Seluruh akses database melalui Prisma ORM dengan parameterized query — tidak ada raw SQL string interpolation dari input user tanpa parameter binding.

## File Upload Security
Validasi tipe MIME dan ukuran maksimum untuk upload foto siswa. File discan sebelum disimpan (jika memungkinkan) atau minimal divalidasi ekstensi & magic bytes. Upload langsung ke Object Storage via presigned URL, backend tidak menjadi proxy penuh untuk file besar.

## Object Storage Security
Bucket bersifat private (tidak ada akses publik langsung). Akses baca/tulis melalui presigned URL dengan masa berlaku singkat. Kebijakan IAM per bucket dipisah antara bucket foto siswa, bucket laporan, dan bucket backup.

## Encryption
TLS wajib untuk seluruh komunikasi (klien↔APP, APP↔Face Service **terutama jika keduanya di server fisik berbeda** — lihat 03-SAD.md §6 dan 11-DEPLOYMENT.md §10, APP↔database bila mendukung). Data sensitif at-rest (`biometric_profiles.embedding_ref`) dienkripsi **AES-256-GCM oleh Face Service** — lihat detail konkret di bagian Biometric Security di bawah (bukan lagi OPEN QUESTION, sudah diimplementasikan).

## Secret Management
Seluruh kredensial (database, Redis, object storage, signing key, camera key hashing salt) disimpan di secret manager/environment variable terenkripsi — TIDAK PERNAH di repository kode (aturan #12).

## Audit Logging
Setiap operasi sensitif (lihat FR-AUDIT-001) dicatat ke `audit_logs` dengan actor, waktu, before/after snapshot (kecuali data biometrik — snapshot tidak boleh memuat embedding). Audit log bersifat append-only secara aplikasi.

## Network Security
Segmentasi jaringan: APP di subnet publik-terbatas (di belakang LB), PostgreSQL/Redis/Object Storage di subnet privat tanpa akses langsung dari internet. Firewall/security group membatasi port hanya yang diperlukan.

## Database Security
Kredensial database berbeda antara APP (read-write terbatas skema aplikasi) dan Worker (jika perlu akses lebih luas). Least privilege per service account. Koneksi database menggunakan TLS jika didukung provider.

## Redis Security
Redis memerlukan autentikasi (requirepass/ACL), tidak diekspos ke internet, dan idealnya dijalankan di subnet privat yang sama dengan PostgreSQL.

## Queue Security
Payload job tidak boleh memuat data biometrik mentah atau kredensial. Job attendance-processing/face-processing hanya membawa referensi ID, bukan embedding.

## Biometric Security
- Embedding biometrik TIDAK PERNAH dikirim ke frontend dalam bentuk apa pun.
- Embedding TIDAK PERNAH ditampilkan di UI (termasuk untuk keperluan debugging).
- Embedding TIDAK PERNAH ditulis ke log aplikasi (structured logging harus secara eksplisit meng-redact field terkait biometrik).
- **Enkripsi konkret (bukan lagi rencana)**: embedding dienkripsi **AES-256-GCM** oleh Face Service SEBELUM dikembalikan ke APP. APP menyimpan hasilnya (`embeddingRef`) sebagai string opaque di `biometric_profiles.embedding_ref` — APP **tidak pernah memiliki kunci dekripsinya** dan secara struktural tidak bisa membaca isi vektor wajah siapa pun, bahkan kalau database APP bocor. Hanya Face Service (yang menyimpan `EMBEDDING_ENCRYPTION_KEY` di environment-nya sendiri, terpisah dari environment APP) yang bisa mendekripsi, dan itu hanya terjadi secara internal saat operasi `/v1/compare`.
- **Implikasi kehilangan kunci**: kalau `EMBEDDING_ENCRYPTION_KEY` di Face Service hilang, SELURUH template biometrik siswa yang sudah di-enroll menjadi tidak bisa didekripsi lagi secara permanen — semua siswa harus enrolment ulang. Kunci ini WAJIB di-backup dengan tingkat kehati-hatian yang sama seperti kredensial database (lihat 12-OPERATIONS.md).
- Akses ke tabel biometrik dibatasi hanya untuk Face Service (bukan APP dashboard biasa) — secara arsitektur, bukan cuma secara kebijakan: APP tidak punya kunci untuk berbuat apa pun dengan isi kolom itu selain menyimpan dan meneruskannya apa adanya.
- **Verifikasi 1:1, bukan 1:N**: perbandingan wajah SELALU antara SATU live capture vs SATU template (milik siswa yang NISN-nya diketik) — sistem tidak pernah mencari "wajah ini milik siapa" di antara seluruh basis siswa. Ini mengurangi risiko false-positive pada skala besar dan sejalan dengan model autentikasi "NISN sebagai identitas yang diklaim, wajah sebagai bukti" (lihat bagian Authentication).
- **Enrolment via softfile**: foto softfile yang diunggah untuk enrolment (baik manual per siswa maupun batch, dari foto rapor) disimpan HANYA sementara (buffer upload di Object Storage bucket enrolment terisolasi) selama proses ekstraksi embedding berlangsung. Setelah embedding berhasil dibuat dan tervalidasi, **foto asli dihapus permanen** dari Object Storage dalam satu alur transaksional dengan penyimpanan embedding — job enrolment tidak dianggap selesai/sukses sampai penghapusan foto asli terkonfirmasi. Tidak ada retensi jangka panjang untuk foto softfile enrolment.
- Jika enrolment gagal (kualitas foto tidak memenuhi syarat, wajah tidak terdeteksi/lebih dari satu wajah), foto sumber tetap dihapus setelah kegagalan tercatat di log enrolment — tidak dibiarkan menumpuk di storage.
- Bucket sementara untuk upload enrolment terpisah dari bucket foto tampilan siswa (`photo_object_key` di tabel `students`, yang memang untuk ditampilkan di UI dan bukan sumber biometrik).
- **Foto check-in (presensi harian) diperlakukan LEBIH KETAT dari foto enrolment**: TIDAK PERNAH ditulis ke Object Storage sama sekali, bahkan sementara. Diproses sepenuhnya di memori (APP dan Face Service) selama satu request berlangsung, lalu dibuang. Alasan: foto check-in jauh lebih sering terjadi (tiap hari, tiap siswa) dibanding foto enrolment (sekali di awal), sehingga risiko akumulasi data sensitif jauh lebih besar kalau ikut disimpan sementara seperti foto enrolment.

## Privacy
Data siswa (PII) diperlakukan sesuai prinsip minimalisasi data — hanya field yang diperlukan untuk fungsi presensi yang disimpan. Akses ke data pribadi siswa dibatasi sesuai role (lihat RBAC).

## Data Retention
Kebijakan retensi (berapa lama attendance log dan terutama embedding biometrik disimpan setelah siswa lulus/keluar) harus ditetapkan oleh kebijakan sekolah/yayasan — OPEN QUESTION, bukan asumsi teknis sepihak. **Terkecuali foto softfile enrolment**, yang kebijakannya sudah ditetapkan: tidak ada retensi sama sekali — dihapus permanen segera setelah embedding berhasil dibuat (lihat Biometric Security di atas).

## Data Deletion
Saat siswa dihapus (soft delete) dari data master, `biometric_profiles` terkait harus dinonaktifkan (is_active=false) segera dan dijadwalkan untuk purge permanen sesuai kebijakan retensi yang disepakati.

## Backup Security
Backup PostgreSQL dan artifact Object Storage yang memuat data sensitif harus dienkripsi saat disimpan dan aksesnya dibatasi setara dengan data produksi (bukan lebih longgar).

## OPEN QUESTIONS

- ~~OQ-SEC-01: Mekanisme enkripsi kolom/tabel untuk `biometric_profiles`~~ — **RESOLVED**: AES-256-GCM di Face Service (lihat Biometric Security di atas).
- OQ-SEC-02: Kebijakan retensi data resmi (attendance, foto, embedding) menunggu keputusan pihak sekolah/yayasan.
- OQ-SEC-03: Kompleksitas password minimum dan kebijakan rotasi kredensial admin belum ditetapkan.
- OQ-SEC-04: Liveness detection (MiniFASNet) **belum divalidasi dengan foto asli** — model belum diuji melawan serangan foto cetak/foto di layar HP secara empiris sebelum kode ini diserahkan (lihat `face-service/README.md` bagian "Yang BELUM diverifikasi"). WAJIB diuji sebelum sistem dipakai siswa sungguhan — endpoint fail-closed (menolak semua) selama model belum terpasang, tapi begitu model terpasang, akurasi anti-spoof-nya belum dibuktikan.
- OQ-SEC-05: Kebijakan sekolah soal NISN sebagai "identitas semi-publik yang boleh dipakai tanpa password" (lihat bagian Authentication) sebaiknya dikonfirmasi eksplisit — bukan diasumsikan dapat diterima begitu saja oleh tim teknis.
