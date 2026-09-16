# Model Liveness Detection (MiniFASNet ONNX)

File model biner (~1-5MB) **sengaja tidak di-bundle** di repo ini — file
biner besar sebaiknya diverifikasi & didownload sendiri oleh yang deploy,
bukan diikutkan mentah-mentah di source control.

## Cara mendapatkan

Pilih SALAH SATU sumber berikut (semua open-source, arsitektur MiniFASNet
yang sama, Apache 2.0/MIT):

### Opsi A — garciafido/minifasnet-v2-anti-spoofing-onnx (HuggingFace)
```bash
pip install huggingface_hub
python -c "
from huggingface_hub import hf_hub_download
path = hf_hub_download(repo_id='garciafido/minifasnet-v2-anti-spoofing-onnx', filename='<nama_file_onnx_di_repo>')
print(path)
"
```
Cek nama file persis di halaman HuggingFace repo tersebut, lalu salin hasil
download ke `./models/minifasnet.onnx`.
- Input: 80×80, BGR, range [0.0, 1.0]
- Set `LIVENESS_INPUT_SIZE=80` di `.env`

### Opsi B — johnraivenolazo/face-antispoof-onnx atau facenox/face-antispoof-onnx (GitHub)
```bash
git clone https://github.com/johnraivenolazo/face-antispoof-onnx
cp face-antispoof-onnx/models/best_model.onnx ./models/minifasnet.onnx
```
- Input: 128×128, **RGB** (bukan BGR!) — kalau pakai model ini, ubah baris
  konversi warna di `app/liveness_engine.py` (uncomment `cv2.cvtColor(...,
  COLOR_BGR2RGB)`)
- Set `LIVENESS_INPUT_SIZE=128` di `.env`

### Opsi C — vendor langsung dari minivision-ai/Silent-Face-Anti-Spoofing
Repo asli menyediakan bobot `.pth` (PyTorch), perlu dikonversi ke ONNX
sendiri (lihat script `export_onnx.py` di beberapa fork seperti
johnraivenolazo/face-antispoof-onnx untuk contoh cara konversi).

## WAJIB diuji sebelum dipakai siswa sungguhan

1. Jalankan `uvicorn app.main:app` lokal.
2. Cek `GET /ready` → harus `"liveness_model": "ok"`.
3. Test manual dengan foto wajah ASLI (harus `passed: true`) dan foto layar
   HP yang menampilkan wajah orang lain / foto cetak (harus `passed: false`).
4. Kalau hasil kebalikannya (foto asli ditolak, foto layar/cetak lolos),
   kemungkinan preprocessing (ukuran input, urutan channel BGR/RGB, index
   kelas output) tidak cocok dengan file model yang dipasang — cek kembali
   dokumentasi model yang dipilih dan sesuaikan `app/liveness_engine.py`.

## Kenapa bukan yang dari `anti-spoofing-fr`

Repo referensi yang kamu tunjukkan (Morteza-Asadi-Shalmaiy/anti-spoofing-fr)
memvendor model yang sama, tapi disajikan sebagai notebook Colab, dan
penulisnya sendiri mencatat kelemahan terhadap foto cetak berkualitas tinggi
serta belum ada metrik akurasi resmi (bagian "Evaluation" masih kosong).
Arsitektur modelnya sama (MiniFASNet), jadi kode di `liveness_engine.py`
tetap kompatibel kalau kamu memang ingin memakai file model persis dari
sana — sesuaikan `LIVENESS_INPUT_SIZE` dan urutan channel sesuai yang
mereka pakai.
