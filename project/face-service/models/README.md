# Model Liveness Detection (MiniFASNet ONNX)

File model biner (~1-5MB) **sengaja tidak di-bundle** di repo ini — file
biner besar sebaiknya diverifikasi & didownload sendiri oleh yang deploy,
bukan diikutkan mentah-mentah di source control.

## Model face detection YOLO

Face-service menggunakan model YOLO khusus deteksi wajah dalam format ONNX
sebagai detector utama. Model YOLO umum untuk object/person detection tidak
boleh dipakai sebagai pengganti model face detector karena class dan perilaku
bounding box-nya berbeda.

Sediakan weight terverifikasi di `./models/yolo-face.onnx` atau ubah
`YOLO_FACE_MODEL_PATH`. Kontrak default model:

- input `float32`, NCHW, RGB, ukuran `640x640`, nilai `[0, 1]`;
- output box ter-decode dengan format `cx, cy, width, height` relatif terhadap
  canvas letterbox, diikuti satu score class face;
- `YOLO_CLASS_COUNT=1`, `YOLO_FACE_CLASS_ID=0`, dan
  `YOLO_HAS_OBJECTNESS=false`.

Jika model hasil export memakai objectness YOLOv5, set
`YOLO_HAS_OBJECTNESS=true`. Jika output box ternormalisasi, set
`YOLO_NORMALIZED_OUTPUT=true`. Jangan mengubah mapping/format ini tanpa
memeriksa metadata export dan menguji foto wajah valid, tidak ada wajah, serta
lebih dari satu wajah. Service akan mengembalikan not-ready jika weight YOLO
atau runtime ONNX belum tersedia; tidak ada fallback diam-diam ke detector
lain.

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
- Set `LIVENESS_INPUT_COLOR_ORDER=BGR`, `LIVENESS_CROP_SCALE=2.7`,
  `LIVENESS_EXPECTED_CLASS_COUNT=3`, dan `LIVENESS_LIVE_CLASS_INDEX=1`.
- Output upstream adalah logits 3 kelas; setelah softmax class `1` adalah
  live/real, sedangkan class `0` dan `2` adalah spoof.

### Opsi B — johnraivenolazo/face-antispoof-onnx atau facenox/face-antispoof-onnx (GitHub)
```bash
git clone https://github.com/johnraivenolazo/face-antispoof-onnx
cp face-antispoof-onnx/models/best_model.onnx ./models/minifasnet.onnx
```
- Input: 128×128, **RGB** (bukan BGR!). Set `LIVENESS_INPUT_SIZE=128`,
  `LIVENESS_INPUT_COLOR_ORDER=RGB`, dan `LIVENESS_EXPECTED_CLASS_COUNT=2`.
- Untuk model `best_model.onnx` dari facenox/johnraivenolazo, set
  `LIVENESS_LIVE_CLASS_INDEX=0` karena outputnya `[real, spoof]`. Jangan
  mengandalkan jumlah kelas saja untuk menebak mapping.

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
   hentikan rollout dan cek kembali kontrak model (ukuran input, crop scale,
   urutan channel BGR/RGB, dan index kelas output). Service akan menolak model
   yang shape input/output-nya tidak cocok, tetapi tidak dapat menebak label
   model custom yang dokumentasinya tidak lengkap.

## Test dataset

Repository ini tidak membawa dataset wajah live/spoof. Test unit untuk
normalisasi, mapping kelas 2/3, dan keputusan threshold dapat dijalankan tanpa
bobot model:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

Untuk uji foto nyata, sediakan folder dengan struktur `live/` dan `spoof/`,
lalu jalankan test opsional dengan `LIVENESS_TEST_DATASET_DIR` setelah model
dan dependency service terpasang. Ambang `0.5` hanyalah default awal dan
harus dikalibrasi pada data kamera/populasi yang benar-benar digunakan.

MiniFASNet adalah passive presentation-attack detector, bukan jaminan
keamanan 100% dan bukan pengganti evaluasi anti-spoofing formal. Foto cetak,
layar, video, pencahayaan, kamera, dan serangan baru dapat menghasilkan
false accept/false reject.

## Kenapa bukan yang dari `anti-spoofing-fr`

Repo referensi yang kamu tunjukkan (Morteza-Asadi-Shalmaiy/anti-spoofing-fr)
memvendor model yang sama, tapi disajikan sebagai notebook Colab, dan
penulisnya sendiri mencatat kelemahan terhadap foto cetak berkualitas tinggi
serta belum ada metrik akurasi resmi (bagian "Evaluation" masih kosong).
Arsitektur modelnya sama (MiniFASNet), jadi kode di `liveness_engine.py`
tetap kompatibel kalau kamu memang ingin memakai file model persis dari
sana — sesuaikan `LIVENESS_INPUT_SIZE` dan urutan channel sesuai yang
mereka pakai.
