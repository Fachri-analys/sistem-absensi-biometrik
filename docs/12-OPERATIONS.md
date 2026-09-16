# 12 — Operations Guide
## Sistem Absensi Biometrik Sekolah

---

## 1. Monitoring & Metrics

Metrics wajib dipantau per komponen:

| Komponen | Metrics Kunci |
|---|---|
| Application | Request rate, error rate (4xx/5xx), latensi P50/P95/P99 per endpoint |
| PostgreSQL | Koneksi aktif, query latency, replication lag (bila ada replica), disk usage |
| Redis | Hit/miss ratio, memory usage, koneksi aktif, evictions |
| Queue | Panjang antrian per queue, job success/failure rate, waktu tunggu job (wait time), dead-letter count |
| Worker | Throughput job/menit, durasi eksekusi job, tingkat kegagalan |
| Object Storage | Error rate request, latensi upload/download |
| Load Balancer | Request rate per instance, health check failure count |

## 2. Logging

Structured logging (JSON) dengan field standar: `timestamp`, `level`, `service`, `requestId`, `userId` (jika ada), `message`, `context`. Field yang berkaitan dengan data biometrik ATAU password/token WAJIB di-redact secara eksplisit sebelum log ditulis (lihat 06-SECURITY-SPEC.md).

## 3. Health Check, Readiness, Liveness

- `GET /api/health`: liveness — proses hidup, tanpa mengecek dependency eksternal.
- `GET /api/ready`: readiness — memverifikasi koneksi PostgreSQL & Redis sehat, digunakan Load Balancer untuk keputusan routing trafik.
- Worker: readiness setara berupa pengecekan koneksi ke Redis/queue broker sebelum dianggap siap menerima job.

## 4. Alerting

Alert dipicu (kanal & threshold pasti OPEN QUESTION, menunggu kesepakatan tim ops) untuk kondisi:
- Error rate API di atas ambang dalam jendela waktu tertentu.
- Dead-letter queue bertambah (indikasi job gagal permanen berulang).
- Readiness check gagal berturut-turut (indikasi dependency down).
- Disk usage PostgreSQL/Object Storage mendekati batas.
- Kegagalan sinkronisasi berturut-turut (indikasi masalah sistem eksternal).

## 5. Backup & Restore

- Backup PostgreSQL: snapshot terjadwal (frekuensi final OPEN QUESTION, minimal harian sebagai baseline) + WAL/point-in-time recovery bila didukung.
- Backup Object Storage: versioning bucket atau replikasi ke bucket backup terpisah untuk artifact penting (laporan, foto siswa).
- Restore diuji berkala di staging untuk memvalidasi RPO/RTO aktual, bukan hanya diasumsikan dari dokumentasi provider.
- **Khusus topologi on-prem mini PC** (lihat 11-DEPLOYMENT.md §6–8): backup TIDAK BOLEH hanya tersimpan di disk lokal mini PC yang sama dengan data produksi. Wajib ada minimal satu salinan terenkripsi di lokasi kedua (cloud storage terpisah atau media eksternal yang disimpan fisik berbeda tempat) — ini prasyarat mutlak sebelum mini PC boleh dimatikan/dipindahkan untuk renovasi sekolah.
- Backup dijadwalkan otomatis (bukan manual sesaat sebelum pindah), sehingga proses relokasi tidak bergantung pada satu backup darurat yang terburu-buru dan berisiko tidak lengkap.

## 5.1 Relocation Readiness (khusus mini PC on-prem)

Sebelum mini PC dimatikan untuk dipindahkan sementara, checklist berikut harus terpenuhi (detail langkah teknis di 11-DEPLOYMENT.md §8):

- Backup terbaru sudah tersalin ke lokasi kedua dan **checksum-nya diverifikasi** (bukan diasumsikan berhasil hanya karena proses backup selesai tanpa error).
- Konfigurasi (`.env`, secret) tersalin terpisah dari volume data, sehingga tidak hilang bersamaan jika volume data korup saat pemindahan fisik.
- Ada rencana eksplisit untuk skenario terburuk: mini PC rusak permanen saat/setelah dipindah → sistem dapat dipulihkan penuh di perangkat pengganti hanya dari backup di lokasi kedua, tanpa bergantung pada mini PC lama sama sekali.
- Setelah dinyalakan kembali di lokasi baru, jalankan verifikasi integritas data (jumlah `students`, `classes`, dan `attendance` terakhir sebelum shutdown harus cocok) sebelum sistem diumumkan aktif kembali ke pengguna sekolah.

## 6. Incident Response

Alur dasar: deteksi (alert/laporan pengguna) → triage (severity) → mitigasi cepat (rollback/failover) → komunikasi ke pemangku kepentingan sekolah bila berdampak layanan → root cause analysis → tindak lanjut perbaikan permanen. Setiap insiden signifikan didokumentasikan (post-incident review) — template dan SLA respons final adalah OPEN QUESTION organisasi.

## 7. Disaster Recovery

Skenario yang perlu rencana pemulihan: kehilangan instance database utama, region/data center tidak tersedia (jika relevan dengan skala deployment), kehilangan seluruh backup terbaru (mitigasi: multiple backup generation). RPO/RTO resmi menunggu kesepakatan dengan sekolah (lihat OQ-SRS-03).

## 8. Capacity Planning

Dipantau berkala berdasarkan tren: jumlah siswa aktif, volume attendance harian, ukuran data sinkronisasi, pertumbuhan Object Storage (foto, laporan). Digunakan untuk menentukan kapan menambah instance APP/Worker atau meningkatkan kapasitas PostgreSQL.

## OPEN QUESTIONS

- OQ-OPS-01: Kanal alerting resmi (email/Slack/SMS) dan threshold pasti belum ditentukan.
- OQ-OPS-02: RPO/RTO resmi dan frekuensi backup final menunggu kesepakatan dengan pihak sekolah.
