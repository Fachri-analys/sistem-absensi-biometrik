# 01 — Product Requirements Document (PRD)
## Sistem Absensi Biometrik Sekolah

Status: Draft v1.0
Source of truth untuk keputusan produk sebelum implementasi dimulai.

---

## 1. Product Overview

Sistem Absensi Biometrik adalah platform absensi berbasis pengenalan wajah (face recognition) untuk sekolah, menggantikan absensi manual/kartu dengan presensi mandiri via HP pribadi siswa. Sistem terdiri dari:

- **Website presensi** yang diakses siswa dari HP masing-masing: siswa mengetik NISN, kamera HP aktif, foto diambil dan dikirim ke server.
- **Face Service** (microservice terpisah) yang melakukan liveness check + face embedding + perbandingan 1:1 terhadap template tersimpan — SELALU di server, tidak pernah mempercayai hasil dari HP siswa.
- Backend yang mencatat hasil presensi, menyimpan data siswa/kelas/jurusan, dan menyajikan dashboard realtime untuk admin/operator.
- Modul pelaporan dan rekapitulasi kehadiran per kelas/jurusan/periode.
- Modul sinkronisasi data siswa/kelas/guru dari sistem sekolah eksternal (mis. Dapodik atau SIS internal sekolah).

Referensi UI awal (HTML) yang sudah dibuat mencakup: pemindai wajah, live camera preview, hasil face match, status liveness, kartu info siswa (NISN, kelas, jurusan, wali kelas), statistik kehadiran harian, log absensi realtime, filter kelas, pencarian, dan export PDF. UI ini menjadi acuan kontrak visual dashboard ADMIN/OPERATOR — bukan tampilan yang dilihat siswa (siswa hanya melihat halaman check-in sederhana: input NISN + kamera).

## 2. Problem Statement

Absensi manual (kertas, tap kartu, panggil nama) di sekolah menghadapi masalah:
- Rawan titip absen / kecurangan kehadiran.
- Proses lambat saat siswa banyak (antrian gerbang).
- Rekap kehadiran manual rentan salah dan lambat sampai ke wali kelas/orang tua.
- Tidak ada data real-time untuk keperluan keamanan (siapa yang ada di lokasi saat ini).
- Sinkronisasi data siswa antar sistem (SIS sekolah, kurikulum, BK) dilakukan manual dan sering tidak konsisten.

## 3. Product Vision

Menjadi sistem presensi sekolah yang cepat (<1 detik per siswa), akurat, aman terhadap data biometrik, dan dapat diaudit — sehingga sekolah punya data kehadiran realtime yang dapat dipercaya untuk keperluan akademik, kedisiplinan, dan pelaporan ke orang tua/dinas pendidikan.

## 4. Product Goals

1. Presensi otomatis via face recognition dengan akurasi tinggi dan latensi rendah.
2. Data siswa/kelas/jurusan yang konsisten dengan sistem sekolah eksternal (melalui sinkronisasi terjadwal + manual).
3. Dashboard realtime untuk admin/operator memantau kehadiran hari berjalan.
4. Laporan/rekap yang dapat diekspor (PDF) per kelas, jurusan, atau periode.
5. Keamanan data biometrik sesuai prinsip least-privilege dan tidak pernah terekspos ke client.
6. Sistem dapat di-scale horizontal dan tetap tersedia saat ada gangguan pada satu komponen (Redis/worker down tidak boleh menjatuhkan absensi inti).

## 5. Non-Goals

- Sistem TIDAK menggantikan sistem akademik penuh (nilai, kurikulum, jadwal pelajaran) — hanya kehadiran.
- Sistem TIDAK melakukan proses pembayaran SPP atau modul keuangan.
- Fase awal TIDAK mencakup absensi guru/karyawan (fokus siswa), kecuali didefinisikan eksplisit di roadmap fase berikutnya.
- Sistem TIDAK bertanggung jawab atas akurasi hardware kamera pihak ketiga (di luar kontrak minimum resolusi/FPS).
- TIDAK menyimpan foto wajah mentah sebagai representasi permanen tanpa kebutuhan (lihat kebijakan retensi di 06-SECURITY-SPEC).

## 6. Target Users

- Admin sekolah (TU/Kesiswaan/TI) yang mengelola data siswa, kelas, kamera, dan laporan.
- Operator lapangan yang memantau layar pemindai wajah harian.
- Wali kelas yang melihat rekap kehadiran kelasnya.
- Manajemen sekolah (kepala sekolah/wakil kepala) yang melihat laporan agregat.
- Siswa sebagai subjek data — berinteraksi langsung dengan sistem via website presensi di HP pribadi (mengetik NISN, mengaktifkan kamera).

## 7. User Personas

**Ahmad Fauzi — Admin TI & Kesiswaan**
Mengelola seluruh konfigurasi sistem: data siswa, kelas, jurusan, kamera, dan user. Butuh kontrol penuh dan audit trail atas perubahan data.

**Sri Wahyuni — Wali Kelas**
Ingin melihat siapa yang hadir/terlambat/tidak hadir di kelasnya hari ini, tanpa perlu akses ke pengaturan sistem.

**Operator Gerbang** *(opsional — hanya relevan jika sekolah menambah kios/kamera bersama di masa depan)*
Memantau layar live scan, menangani kasus wajah tidak dikenali (fallback manual), tidak mengubah data master. Untuk alur utama (siswa presensi via HP pribadi), tidak ada operator yang berdiri di gerbang — dashboard dipantau dari mana saja.

**Kepala Sekolah — Viewer**
Melihat dashboard ringkas dan laporan bulanan/semester, tanpa hak ubah data.

## 8. User Journey

1. Siswa buka website presensi di HP pribadi, mengetik NISN.
2. Kamera HP aktif, siswa mengambil foto wajahnya sendiri.
3. Foto dikirim ke server — server (via Face Service) melakukan liveness check, generate embedding, dan membandingkan 1:1 dengan template biometrik siswa tersebut (bukan mencari ke seluruh basis siswa).
4. Jika liveness lolos dan kecocokan ≥ threshold, sistem mencatat kehadiran (tepat waktu/terlambat berdasarkan jadwal) dan menampilkan konfirmasi ke siswa di HP-nya.
5. Event kehadiran dikirim ke dashboard realtime admin/operator (SSE) dan masuk ke log absensi.
6. Admin/wali kelas dapat memfilter, mencari, dan mengekspor laporan kapan saja.
7. Data siswa/kelas disinkronkan berkala dari sistem sekolah eksternal; admin bisa memicu sinkronisasi manual dan melihat status/log sinkronisasi.

Catatan: kamera/kios fisik (`cameras` table) tetap didukung sebagai jalur alternatif untuk perangkat tepercaya milik sekolah (mis. jika suatu saat ditambah kios di gerbang) — tapi ini BUKAN jalur utama, dan tidak wajib diimplementasikan di MVP.

## 9. User Stories (contoh representatif)

- Sebagai admin, saya ingin menambah/mengedit data siswa agar data selalu akurat.
- Sebagai operator, saya ingin melihat hasil pemindaian wajah secara realtime agar bisa menindaklanjuti kasus tidak dikenali.
- Sebagai wali kelas, saya ingin melihat rekap kehadiran kelas saya hari ini dan bulan ini.
- Sebagai admin, saya ingin mengekspor laporan kehadiran ke PDF untuk diserahkan ke kepala sekolah.
- Sebagai SUPER_ADMIN, saya ingin mengatur role pengguna lain agar akses sesuai tanggung jawab.
- Sebagai admin, saya ingin memicu sinkronisasi data siswa dari sistem sekolah eksternal dan melihat log kegagalannya.
- Sebagai security engineer, saya ingin memastikan data biometrik tidak pernah terkirim ke frontend.

## 10. Functional Scope

- Autentikasi & RBAC (5 role).
- Manajemen data siswa, kelas, jurusan, guru/wali kelas.
- Enrolment biometrik siswa via upload foto softfile (manual per siswa & batch upload) dari foto rapor.
- Manajemen kamera/kios (opsional — untuk perangkat tepercaya milik sekolah, bukan jalur utama).
- Pipeline presensi mandiri: siswa input NISN → kamera HP aktif → liveness → embedding → similarity 1:1 → keputusan hadir → notifikasi realtime.
- Dashboard statistik kehadiran (harian, per kelas).
- Log absensi realtime dengan filter & pencarian.
- Export laporan (PDF), rekap periode.
- Sinkronisasi data eksternal (full & incremental).
- Audit log untuk operasi sensitif.

## 11. Non-Functional Scope

- Skalabilitas horizontal (stateless backend, worker terpisah).
- Ketersediaan tinggi (degradasi anggun saat Redis/worker down).
- Keamanan data biometrik dan data pribadi siswa (PII).
- Observability (logging terstruktur, metrics, health check).
- Idempotency untuk seluruh operasi async dan sinkronisasi.

## 12. Feature Priorities

| Prioritas | Fitur |
|---|---|
| P0 | Auth+RBAC, CRUD siswa/kelas/jurusan, pipeline presensi inti, log realtime, dashboard statistik |
| P1 | Export PDF, filter/pencarian lanjutan, manajemen kamera, sinkronisasi eksternal |
| P2 | Notifikasi (WA/email), laporan rekap periode lanjutan, audit log UI |
| P3 | Multi-sekolah/tenant, absensi guru/karyawan |

## 13. MVP Scope

Auth+RBAC dasar (ADMIN, OPERATOR, VIEWER), CRUD data master (siswa, kelas, jurusan), pipeline presensi (menerima hasil recognition dari kamera, simpan ke PostgreSQL, tampilkan di dashboard), log absensi realtime via WebSocket/SSE, statistik harian, export PDF sederhana.

## 14. Phase 2

Sinkronisasi data eksternal (full & incremental, retry, conflict handling), manajemen kamera lengkap, role WALI_KELAS & SUPER_ADMIN, notifikasi ke wali kelas, caching dashboard stats, queue/worker untuk pemrosesan berat (report generation, face processing offload).

## 15. Phase 3

Observability penuh (metrics/alerting), hardening keamanan (rate limiting, audit lengkap), CDN + Load Balancer produksi, laporan lanjutan (semester/tahunan), object storage lifecycle policy, disaster recovery playbook teruji.

## 16. Success Metrics

- Waktu proses presensi per siswa < 1.5 detik (P95) dari capture ke simpan.
- Presensi hanya dianggap valid jika skor kecocokan wajah ≥ 90% (match threshold resmi, lihat NFR-ACC-001 di 02-SRS.md) — hasil di bawah itu tidak tercatat sebagai kehadiran.
- Uptime pipeline presensi ≥ 99.5% saat jam masuk sekolah.
- 100% operasi sensitif (ubah data siswa, ubah role, export data) tercatat di audit log.
- Waktu sinkronisasi data siswa penuh selesai dalam jendela operasional yang ditentukan sekolah (mis. di luar jam masuk).

## 17. Risks

- Akurasi face recognition dipengaruhi kualitas kamera HP siswa yang sangat beragam (model, tahun, kondisi lensa) dan pencahayaan saat presensi — lebih sulit dikendalikan dibanding kamera terkelola sekolah, karena setiap siswa pakai perangkat masing-masing.
- Engine face recognition sudah dipilih (InsightFace + MiniFASNet, self-hosted) tapi akurasinya untuk populasi wajah siswa Indonesia secara spesifik belum dievaluasi dengan data sungguhan — lihat `face-service/README.md`.
- Data biometrik adalah data sangat sensitif — kebocoran berdampak hukum & reputasi.
- Sinkronisasi dengan sistem eksternal yang tidak stabil dapat menyebabkan data stale.
- Beban tinggi saat jam masuk serentak (banyak siswa dalam waktu singkat) — perlu load testing.

## 18. Assumptions

- Setiap siswa memiliki satu profil biometrik terdaftar sebelum sistem digunakan. Enrolment dilakukan melalui upload foto softfile dari **rapor** (bukan live capture) untuk akurasi lebih tinggi — didukung dua jalur input: upload manual per siswa oleh admin, dan batch upload massal (mis. saat sinkronisasi data siswa awal). Foto asli dihapus permanen segera setelah embedding berhasil dibuat (lihat 06-SECURITY-SPEC.md).
- Siswa mengakses website presensi dari HP pribadi masing-masing (browser modern dengan dukungan akses kamera) — bukan perangkat kamera fisik terkelola sekolah. Kamera/kios (`cameras` table) tetap didukung sebagai jalur opsional untuk perangkat tepercaya di masa depan.
- Sistem sekolah eksternal menyediakan API atau ekspor data yang dapat diakses secara terjadwal (struktur pastinya OPEN QUESTION, lihat aturan #3 di prompt asal).
- Koneksi internet siswa (data seluler/WiFi sekolah) cukup stabil untuk mengunggah satu foto per sesi presensi ke server.

## 19. Dependencies

- **Face Service** (self-hosted, open-source): InsightFace (buffalo_l) untuk embedding + MiniFASNet ONNX untuk liveness detection — lihat `face-service/README.md` pada kode sumber. Dipilih karena tanpa lisensi berbayar (dibandingkan dengan opsi vendor komersial seperti Recognito Vision yang butuh Windows Server + lisensi HWID).
- Sistem sekolah eksternal sebagai sumber data siswa/kelas/guru.
- Infrastruktur: dua server terpisah — satu untuk APP (Next.js, di-hosting via cPanel) dan satu untuk Face Service (Python, Linux, tidak butuh GPU/Windows) — lihat 11-DEPLOYMENT.md.
- Kanal notifikasi (WA Business API/email) untuk Phase 2.

## 20. Future Roadmap

Multi-sekolah (tenant per sekolah), absensi guru/karyawan, integrasi rapor kedisiplinan, mobile app orang tua, analitik prediktif keterlambatan/ketidakhadiran.

---

## Roles

| Role | Deskripsi Kebutuhan |
|---|---|
| SUPER_ADMIN | Akses penuh seluruh sistem termasuk manajemen user & role, konfigurasi sistem, dan seluruh data. Satu-satunya role yang dapat mengubah role pengguna lain. |
| ADMIN | Mengelola data master (siswa, kelas, jurusan, guru), kamera, dan melihat seluruh laporan. Tidak dapat mengubah role SUPER_ADMIN atau konfigurasi infrastruktur inti. |
| OPERATOR | Mengoperasikan layar pemindai wajah harian, menangani kasus manual/tidak dikenali, melihat log absensi realtime. Tidak dapat mengubah data master siswa/kelas. |
| WALI_KELAS | Melihat data dan rekap kehadiran hanya untuk kelas yang diampu. Tidak dapat mengakses data kelas lain atau pengaturan sistem. |
| VIEWER | Akses baca-saja ke dashboard dan laporan agregat (mis. kepala sekolah). Tidak dapat mengubah data apa pun. |

## OPEN QUESTIONS

- ~~OQ-PRD-01: Vendor/engine face recognition & liveness belum ditentukan~~ — **RESOLVED**: InsightFace (buffalo_l) + MiniFASNet ONNX, self-hosted open-source, tanpa lisensi berbayar. Lihat `face-service/README.md` di kode sumber untuk detail dan status verifikasi.
- OQ-PRD-02: Struktur dan protokol sistem sekolah eksternal (Dapodik/SIS internal) belum diketahui.
- OQ-PRD-03: Apakah absensi pulang (check-out) termasuk cakupan MVP atau Phase 2?
- OQ-PRD-04: Kebijakan resmi retensi foto/embedding biometrik (berapa lama disimpan) perlu keputusan sekolah/yayasan, bukan asumsi teknis.
- OQ-PRD-05: Autentikasi siswa saat check-in hanya berbasis NISN (tanpa password) — wajah menjadi faktor pembuktian utama. Ini keputusan yang disengaja (lihat 06-SECURITY-SPEC.md), tapi kebijakan sekolah soal apakah NISN dianggap "cukup publik" untuk dipakai begini sebaiknya dikonfirmasi eksplisit dengan pihak sekolah.
