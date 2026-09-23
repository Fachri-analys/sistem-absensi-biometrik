# Panduan Evaluasi Threshold Face Matching (Biometrik Absensi)

Dokumen ini adalah panduan operasional untuk melakukan pengujian dan penentuan ambang batas (*match threshold*) verifikasi wajah 1:1 secara empiris menggunakan dataset foto siswa nyata.

> **Prinsip Utama**: Penentuan threshold tidak boleh dilakukan berdasarkan asumsi atau angka tebakan semata. Threshold optimal harus didapatkan dari data pengujian nyata dengan menyeimbangkan **False Acceptance Rate (FAR)** dan **False Rejection Rate (FRR)**.

---

## 1. Struktur Dataset Wajah

Dataset pengujian harus disiapkan dalam direktori terpisah dengan struktur folder per siswa sebagai berikut:

```text
dataset/
├── student_001/
│   ├── photo_frontal.jpg
│   ├── photo_left.jpg
│   ├── photo_right.jpg
│   └── photo_dim_light.jpg
├── student_002/
│   ├── photo_frontal.jpg
│   ├── photo_smile.jpg
│   └── photo_outdoor.jpg
├── student_003/
│   ├── photo_1.jpg
│   └── photo_2.jpg
└── ...
```

### Ketentuan Dataset:
1. **Nama Subdirektori**: Gunakan ID siswa / NISN unik sebagai nama folder (misal `student_001`, `1029384756`).
2. **Format File**: `.jpg`, `.jpeg`, atau `.png`.
3. **Jumlah Siswa**: Minimal 2 siswa (untuk menghasilkan pasangan impostor). Untuk evaluasi threshold produksi yang representatif, disarankan minimal **30–50+ siswa**.
4. **Jumlah Foto per Siswa**:
   - Minimal 2 foto per siswa (untuk menghasilkan pasangan genuine).
   - Disarankan **3–5 foto per siswa** yang mencakup variasi:
     - Wajah menghadap depan (*frontal*).
     - Sedikit miring ke kiri / kanan ($\le 20^\circ$).
     - Variasi kondisi pencahayaan (pagi/siang alami, lampu ruangan).
     - Ekspresi wajar (netral, tersenyum wajar).
5. **Kualitas Gambar**:
   - Resolusi minimal $200 \times 200$ piksel (disarankan $\ge 640 \times 480$ piksel).
   - Fokus tajam (tidak blur).
   - Wajah tidak terpotong di tepi bingkai gambar.
   - Tanpa masker atau kacamata hitam yang menutupi area mata dan hidung.

---

## 2. Cara Menjalankan Script Evaluasi

Script evaluasi berlokasi di `project/face-service/scripts/evaluate_matching.py`.

### A. Evaluasi Standar (Mode Pairwise)
Membandingkan seluruh kombinasi foto dalam siswa yang sama (genuine) dan antar siswa berbeda (impostor):

```bash
cd project/face-service
python -m scripts.evaluate_matching --dataset-dir /path/to/dataset
```

### B. Evaluasi Menyerupai Sistem Produksi (Mode Gallery-Probe)
Meniru persis mekanisme pendaftaran multi-sample dan absensi siswa di lapangan (beberapa foto awal sebagai template tersimpan di sistem, dan foto sisanya sebagai simulasi absensi harian):

```bash
cd project/face-service
python -m scripts.evaluate_matching --dataset-dir /path/to/dataset --mode gallery-probe --gallery-size 2
```

### C. Menyesuaikan Rentang & Ketelitian Sweep Threshold
Untuk menyisir nilai ambang batas secara lebih detail (misal dari 0.25 sampai 0.65 dengan kenaikan 0.01):

```bash
python -m scripts.evaluate_matching --dataset-dir /path/to/dataset --min-threshold 0.25 --max-threshold 0.65 --step 0.01
```

### D. Menyimpan Hasil ke Format JSON dan CSV
Untuk analisis lebih lanjut menggunakan spreadsheet atau visualisasi grafik ROC:

```bash
python -m scripts.evaluate_matching --dataset-dir /path/to/dataset --output-json ./reports/eval_results.json --output-csv ./reports/eval_sweep.csv
```

---

## 3. Penjelasan Metrik Evaluasi

Pada setiap ambang batas $\tau$ (*threshold*), script menghitung:

| Metrik | Nama Lengkap | Definisi & Rumus | Keterangan |
|---|---|---|---|
| **TP** | True Positive | Jumlah pasangan genuine dengan skor $\ge \tau$ | Siswa asli berhasil diverifikasi |
| **FN** | False Negative | Jumlah pasangan genuine dengan skor $< \tau$ | Siswa asli keliru ditolak |
| **TN** | True Negative | Jumlah pasangan impostor dengan skor $< \tau$ | Orang lain berhasil ditolak |
| **FP** | False Positive | Jumlah pasangan impostor dengan skor $\ge \tau$ | Orang lain keliru diterima |
| **Precision** | Presisi | $\frac{\text{TP}}{\text{TP} + \text{FP}}$ | Akurasi saat sistem menyatakan cocok |
| **Recall / TAR** | True Accept Rate | $\frac{\text{TP}}{\text{TP} + \text{FN}}$ | Persentase siswa asli yang berhasil absen |
| **F1-Score** | F1 Harmonic Mean | $2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$ | Keseimbangan presisi dan recall |
| **FAR** | False Acceptance Rate | $\frac{\text{FP}}{\text{FP} + \text{TN}}$ | **Risiko Keamanan**: Orang lain berhasil membobol presensi |
| **FRR** | False Rejection Rate | $\frac{\text{FN}}{\text{TP} + \text{FN}} = 1 - \text{Recall}$ | **Tingkat Keluhan Siswa**: Siswa asli gagal absen |

---

## 4. Panduan Memilih Threshold Optimal

Berdasarkan tabel sweep yang dihasilkan, tentukan threshold sesuai prioritas operasional sekolah:

```text
Threshold Rendah (misal 0.30) ◄───────────────► Threshold Tinggi (misal 0.60)
FRR Rendah (Mudah absen)                         FRR Tinggi (Sering ditolak)
FAR Tinggi (Rentan joki absen)                   FAR Rendah (Sangat aman)
```

1. **Rekomendasi 1: Equal Error Rate (EER)**
   - Titik di mana $\text{FAR} \approx \text{FRR}$.
   - Cocok untuk baseline seimbang antara keamanan dan kenyamanan.
2. **Rekomendasi 2: Maximum F1-Score**
   - Titik optimal yang memaksimalkan keberhasilan absensi sekaligus meminimalkan kesalahan identifikasi.
3. **Rekomendasi 3: Security-First (Anti-Joki Presensi)**
   - Jika sekolah memprioritaskan pencegahan kecurangan presensi, pilih threshold terkecil yang menghasilkan **$\text{FAR} \le 0.1\%$ atau $\le 1.0\%$**.

---

## 5. Menerapkan Threshold Terpilih ke Sistem

Setelah mendapatkan nilai threshold optimal (contoh: `0.42`), terapkan ke konfigurasi tanpa perlu mengubah kode sumber:

### 1. Pada Server Face Service (`face-service/.env`)
```bash
MATCH_THRESHOLD=0.42
```

### 2. Pada Server Next.js APP (`project/.env`)
Gunakan override global agar langsung berlaku ke semua kelas:
```bash
FACE_MATCH_THRESHOLD_OVERRIDE=0.42
```

Restart service atau container terkait untuk memuat nilai baru.
