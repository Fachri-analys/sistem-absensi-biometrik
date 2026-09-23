"""
Script Evaluasi Threshold Face Matching (Biometrik Absensi).

Membandingkan performa genuine match (siswa yang sama) vs impostor match (siswa berbeda)
menggunakan dataset wajah nyata untuk menentukan threshold optimal secara empiris.

Metrik yang dihitung pada setiap threshold:
- TP (True Positive)
- TN (True Negative)
- FP (False Positive)
- FN (False Negative)
- Precision: TP / (TP + FP)
- Recall / TAR (True Accept Rate): TP / (TP + FN)
- F1-Score: 2 * (Precision * Recall) / (Precision + Recall)
- FAR (False Acceptance Rate): FP / (FP + TN)
- FRR (False Rejection Rate): FN / (TP + FN)
- EER (Equal Error Rate): Titik di mana |FAR - FRR| minimum

Struktur dataset yang diharapkan:
    dataset/
      student_001/
        photo1.jpg
        photo2.jpg
      student_002/
        photo1.jpg
        photo2.jpg
      ...
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from dataclasses import asdict, dataclass
from itertools import combinations
from pathlib import Path
from typing import Any

import numpy as np

# Tambahkan root face-service ke sys.path jika script dijalankan langsung
_current_dir = Path(__file__).resolve().parent
_face_service_dir = _current_dir.parent
if str(_face_service_dir) not in sys.path:
    sys.path.insert(0, str(_face_service_dir))


@dataclass
class ThresholdMetrics:
    threshold: float
    tp: int
    tn: int
    fp: int
    fn: int
    total_genuine: int
    total_impostor: int
    precision: float
    recall: float
    f1_score: float
    far: float
    frr: float


def calculate_metrics(
    genuine_scores: list[float],
    impostor_scores: list[float],
    threshold: float,
) -> ThresholdMetrics:
    """
    Menghitung metrik klasifikasi verifikasi biometrik 1:1 pada ambang batas (threshold) tertentu.

    Genuine score: skor kemiripan antara foto-foto dari siswa yang sama.
    Impostor score: skor kemiripan antara foto siswa A dan siswa B.
    """
    total_genuine = len(genuine_scores)
    total_impostor = len(impostor_scores)

    # True Positive: genuine match yang lolos threshold (skor >= threshold)
    tp = sum(1 for s in genuine_scores if s >= threshold)
    # False Negative: genuine match yang ditolak keliru (skor < threshold)
    fn = total_genuine - tp

    # False Positive: impostor match yang lolos keliru (skor >= threshold)
    fp = sum(1 for s in impostor_scores if s >= threshold)
    # True Negative: impostor match yang berhasil ditolak (skor < threshold)
    tn = total_impostor - fp

    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    f1 = (
        float(2 * precision * recall / (precision + recall))
        if (precision + recall) > 0
        else 0.0
    )

    far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    frr = float(fn / (tp + fn)) if (tp + fn) > 0 else 0.0

    return ThresholdMetrics(
        threshold=round(threshold, 4),
        tp=tp,
        tn=tn,
        fp=fp,
        fn=fn,
        total_genuine=total_genuine,
        total_impostor=total_impostor,
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1, 4),
        far=round(far, 4),
        frr=round(frr, 4),
    )


def sweep_thresholds(
    genuine_scores: list[float],
    impostor_scores: list[float],
    min_threshold: float = 0.20,
    max_threshold: float = 0.80,
    step: float = 0.05,
) -> list[ThresholdMetrics]:
    """
    Melakukan sweep multi-threshold dari min_threshold sampai max_threshold.
    """
    results: list[ThresholdMetrics] = []
    current = min_threshold
    while current <= max_threshold + 1e-9:
        metrics = calculate_metrics(genuine_scores, impostor_scores, current)
        results.append(metrics)
        current += step
    return results


def find_optimal_thresholds(sweep_results: list[ThresholdMetrics]) -> dict[str, Any]:
    """
    Menganalisis hasil sweep untuk merekomendasikan:
    1. EER (Equal Error Rate): titik di mana |FAR - FRR| paling kecil.
    2. Best F1: titik kompromi presisi dan recall tertinggi.
    3. Low FAR (Security Priority): FAR <= 0.01 (1%) atau nilai FAR terendah berikutnya.
    """
    if not sweep_results:
        return {}

    best_eer_item = min(sweep_results, key=lambda m: abs(m.far - m.frr))
    best_f1_item = max(sweep_results, key=lambda m: m.f1_score)

    # Threshold dengan FAR <= 1% (atau terendah jika tidak ada yang <= 1%)
    low_far_candidates = [m for m in sweep_results if m.far <= 0.01]
    low_far_item = (
        max(low_far_candidates, key=lambda m: m.recall)
        if low_far_candidates
        else min(sweep_results, key=lambda m: m.far)
    )

    return {
        "eer_threshold": {
            "threshold": best_eer_item.threshold,
            "far": best_eer_item.far,
            "frr": best_eer_item.frr,
            "diff": round(abs(best_eer_item.far - best_eer_item.frr), 4),
        },
        "max_f1_threshold": {
            "threshold": best_f1_item.threshold,
            "f1_score": best_f1_item.f1_score,
            "precision": best_f1_item.precision,
            "recall": best_f1_item.recall,
        },
        "high_security_threshold": {
            "threshold": low_far_item.threshold,
            "far": low_far_item.far,
            "frr": low_far_item.frr,
            "recall": low_far_item.recall,
        },
    }


def load_dataset_images(dataset_dir: str | Path) -> dict[str, list[Path]]:
    """
    Memindai dataset directory dengan struktur:
    dataset_dir/
      student_001/
        photo1.jpg
        photo2.png
      student_002/
        ...
    """
    path = Path(dataset_dir)
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(
            f"Direktori dataset '{dataset_dir}' tidak ditemukan atau bukan direktori."
        )

    valid_extensions = {".jpg", ".jpeg", ".png"}
    dataset: dict[str, list[Path]] = {}

    for sub in sorted(path.iterdir()):
        if sub.is_dir() and not sub.name.startswith("."):
            photos = sorted(
                [
                    p
                    for p in sub.iterdir()
                    if p.is_file() and p.suffix.lower() in valid_extensions
                ]
            )
            if photos:
                dataset[sub.name] = photos

    return dataset


def extract_embeddings_from_dataset(
    dataset_photos: dict[str, list[Path]],
    skip_quality: bool = False,
) -> tuple[dict[str, list[np.ndarray]], dict[str, list[dict[str, str]]]]:
    """
    Mengekstrak embedding dari setiap foto siswa dengan validasi kualitas.
    Mengembalikan:
      (student_embeddings, quality_failures)
    """
    from app.face_engine import face_engine

    student_embeddings: dict[str, list[np.ndarray]] = {}
    quality_failures: dict[str, list[dict[str, str]]] = {}

    for student_id, photos in dataset_photos.items():
        embeddings: list[np.ndarray] = []
        failures: list[dict[str, str]] = []

        for p in photos:
            try:
                img_bytes = p.read_bytes()
                detected, quality = face_engine.extract_face_with_quality(img_bytes)

                if not quality.is_valid or detected is None:
                    failures.append({"file": p.name, "reason": quality.reason or "unknown"})
                    if not skip_quality:
                        continue

                if detected is not None:
                    embeddings.append(detected.embedding)
            except Exception as exc:
                failures.append({"file": p.name, "reason": f"error: {exc}"})

        if embeddings:
            student_embeddings[student_id] = embeddings
        if failures:
            quality_failures[student_id] = failures

    return student_embeddings, quality_failures


def generate_pairwise_scores(
    student_embeddings: dict[str, list[np.ndarray]],
    clamp: bool = True,
) -> tuple[list[float], list[float]]:
    """
    Menghitung skor cosine similarity untuk semua pasangan genuine dan impostor.
    Mode pairwise: membandingkan setiap foto dengan setiap foto lainnya.
    """
    from app.face_engine import FaceEngine

    genuine_scores: list[float] = []
    impostor_scores: list[float] = []

    students = list(student_embeddings.keys())

    # 1. Genuine pairs (dalam siswa yang sama)
    for student_id, embs in student_embeddings.items():
        if len(embs) >= 2:
            for emb_a, emb_b in combinations(embs, 2):
                sim = FaceEngine.cosine_similarity(emb_a, emb_b, clamp=clamp)
                genuine_scores.append(sim)

    # 2. Impostor pairs (antar siswa yang berbeda)
    for i in range(len(students)):
        for j in range(i + 1, len(students)):
            s_a = students[i]
            s_b = students[j]
            for emb_a in student_embeddings[s_a]:
                for emb_b in student_embeddings[s_b]:
                    sim = FaceEngine.cosine_similarity(emb_a, emb_b, clamp=clamp)
                    impostor_scores.append(sim)

    return genuine_scores, impostor_scores


def generate_gallery_probe_scores(
    student_embeddings: dict[str, list[np.ndarray]],
    gallery_size: int = 2,
    clamp: bool = True,
) -> tuple[list[float], list[float]]:
    """
    Menghitung skor berdasarkan mekanisme produksi (Multi-Sample Gallery vs Probe):
    - Untuk setiap siswa, K foto pertama dijadikan template tersimpan (gallery).
    - Foto sisanya dijadikan probe (simulasi live check-in).
    - Skor kemiripan = max similarity antara probe dan semua vektor gallery (seperti endpoint /v1/compare).
    """
    from app.face_engine import FaceEngine

    genuine_scores: list[float] = []
    impostor_scores: list[float] = []

    students = list(student_embeddings.keys())
    gallery_dict: dict[str, list[np.ndarray]] = {}
    probe_dict: dict[str, list[np.ndarray]] = {}

    for s, embs in student_embeddings.items():
        if len(embs) > gallery_size:
            gallery_dict[s] = embs[:gallery_size]
            probe_dict[s] = embs[gallery_size:]
        elif len(embs) >= 2:
            gallery_dict[s] = embs[:1]
            probe_dict[s] = embs[1:]

    # 1. Genuine: probe siswa s dicocokkan ke gallery siswa s
    for s, probes in probe_dict.items():
        gallery = gallery_dict.get(s, [])
        if not gallery:
            continue
        for probe in probes:
            best_sim = max(
                FaceEngine.cosine_similarity(probe, g, clamp=clamp) for g in gallery
            )
            genuine_scores.append(best_sim)

    # 2. Impostor: probe siswa s dicocokkan ke gallery siswa lain
    for s_probe, probes in probe_dict.items():
        for s_gallery, gallery in gallery_dict.items():
            if s_probe == s_gallery:
                continue
            for probe in probes:
                best_sim = max(
                    FaceEngine.cosine_similarity(probe, g, clamp=clamp) for g in gallery
                )
                impostor_scores.append(best_sim)

    return genuine_scores, impostor_scores


def format_markdown_table(sweep_results: list[ThresholdMetrics]) -> str:
    """
    Format hasil sweep ke tabel Markdown yang rapi.
    """
    lines = [
        "| Threshold | TP | FP | TN | FN | Precision | Recall (TAR) | F1-Score | FAR | FRR |",
        "|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|",
    ]
    for r in sweep_results:
        lines.append(
            f"| **{r.threshold:.2f}** | {r.tp} | {r.fp} | {r.tn} | {r.fn} | "
            f"{r.precision:.4f} | {r.recall:.4f} | {r.f1_score:.4f} | "
            f"**{r.far:.4f}** ({r.far*100:.1f}%) | **{r.frr:.4f}** ({r.frr*100:.1f}%) |"
        )
    return "\n".join(lines)


def run_evaluation(
    dataset_dir: str | Path,
    min_threshold: float = 0.20,
    max_threshold: float = 0.80,
    step: float = 0.05,
    mode: str = "pairwise",
    gallery_size: int = 2,
    skip_quality: bool = False,
    output_json: str | None = None,
    output_csv: str | None = None,
) -> dict[str, Any]:
    """
    Eksekusi alur evaluasi lengkap dari pembacaan direktori sampai pelaporan rekomendasi.
    """
    print(f"\n[1/4] Memindai dataset dari: {dataset_dir}")
    dataset_photos = load_dataset_images(dataset_dir)
    total_students = len(dataset_photos)
    total_photos = sum(len(p) for p in dataset_photos.values())
    print(f"      Ditemukan {total_students} siswa dengan total {total_photos} foto.")

    if total_students < 2:
        raise ValueError(
            f"Dataset membutuhkan minimal 2 siswa untuk pengujian impostor. Ditemukan: {total_students}."
        )

    print("\n[2/4] Mengekstrak embedding wajah dan memvalidasi kualitas foto...")
    student_embeddings, failures = extract_embeddings_from_dataset(
        dataset_photos, skip_quality=skip_quality
    )
    valid_students = len(student_embeddings)
    valid_photos = sum(len(v) for v in student_embeddings.values())
    print(f"      Berhasil mengekstrak {valid_photos} foto valid dari {valid_students} siswa.")

    if failures:
        total_failed = sum(len(f) for f in failures.values())
        print(f"      [PERINGATAN] {total_failed} foto gagal lolos quality check:")
        for s, flist in list(failures.items())[:5]:
            for item in flist[:3]:
                print(f"        - {s}/{item['file']}: {item['reason']}")
        if len(failures) > 5:
            print(f"        ... dan {len(failures) - 5} siswa lainnya.")

    print(f"\n[3/4] Menghasilkan pasangan skor perbandingan (Mode: {mode})...")
    if mode == "gallery-probe":
        genuine_scores, impostor_scores = generate_gallery_probe_scores(
            student_embeddings, gallery_size=gallery_size
        )
    else:
        genuine_scores, impostor_scores = generate_pairwise_scores(student_embeddings)

    print(f"      Total Genuine Pairs  : {len(genuine_scores)}")
    print(f"      Total Impostor Pairs : {len(impostor_scores)}")

    if not genuine_scores:
        print(
            "      [PERINGATAN] Tidak ada pasangan genuine ditemukan. Pastikan ada minimal satu siswa dengan >= 2 foto."
        )
    if not impostor_scores:
        print(
            "      [PERINGATAN] Tidak ada pasangan impostor ditemukan. Pastikan ada minimal 2 siswa berbeda."
        )

    if genuine_scores:
        print(
            f"      Skor Genuine  : Min={min(genuine_scores):.4f}, Mean={np.mean(genuine_scores):.4f}, Max={max(genuine_scores):.4f}"
        )
    if impostor_scores:
        print(
            f"      Skor Impostor : Min={min(impostor_scores):.4f}, Mean={np.mean(impostor_scores):.4f}, Max={max(impostor_scores):.4f}"
        )

    print(
        f"\n[4/4] Melakukan sweep threshold [{min_threshold:.2f} s/d {max_threshold:.2f}, step {step:.2f}]..."
    )
    sweep_results = sweep_thresholds(
        genuine_scores, impostor_scores, min_threshold, max_threshold, step
    )
    optimal = find_optimal_thresholds(sweep_results)

    # Cetak tabel Markdown
    print("\n" + format_markdown_table(sweep_results) + "\n")

    # Cetak rekomendasi
    print("=" * 60)
    print(" HASIL ANALISIS & REKOMENDASI THRESHOLD BERBASIS DATA NYATA")
    print("=" * 60)
    if optimal.get("eer_threshold"):
        eer = optimal["eer_threshold"]
        print(
            f"• Equal Error Rate (EER) Threshold: {eer['threshold']:.2f}"
            f" (FAR={eer['far']*100:.2f}%, FRR={eer['frr']*100:.2f}%)"
        )
    if optimal.get("max_f1_threshold"):
        f1_opt = optimal["max_f1_threshold"]
        print(
            f"• Best F1-Score Threshold         : {f1_opt['threshold']:.2f}"
            f" (F1={f1_opt['f1_score']:.4f}, Prec={f1_opt['precision']:.4f}, Rec={f1_opt['recall']:.4f})"
        )
    if optimal.get("high_security_threshold"):
        sec = optimal["high_security_threshold"]
        print(
            f"• High Security (Low FAR) Threshold: {sec['threshold']:.2f}"
            f" (FAR={sec['far']*100:.2f}%, FRR={sec['frr']*100:.2f}%)"
        )
    print("=" * 60)
    print(
        "\nUntuk menerapkan threshold ke sistem produksi, atur environment variable:\n"
        f"  MATCH_THRESHOLD={optimal.get('eer_threshold', {}).get('threshold', 0.40):.2f} (di face-service/.env)\n"
        f"  FACE_MATCH_THRESHOLD_OVERRIDE={optimal.get('eer_threshold', {}).get('threshold', 0.40):.2f} (di project/.env)\n"
    )

    report_data = {
        "dataset_summary": {
            "total_students": total_students,
            "total_photos": total_photos,
            "valid_students": valid_students,
            "valid_photos": valid_photos,
            "genuine_pairs": len(genuine_scores),
            "impostor_pairs": len(impostor_scores),
        },
        "recommendations": optimal,
        "sweep_results": [asdict(r) for r in sweep_results],
    }

    if output_json:
        out_p = Path(output_json)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(report_data, indent=2), encoding="utf-8")
        print(f"[OK] Laporan lengkap JSON disimpan ke: {output_json}")

    if output_csv:
        out_c = Path(output_csv)
        out_c.parent.mkdir(parents=True, exist_ok=True)
        with open(out_c, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "threshold",
                    "tp",
                    "tn",
                    "fp",
                    "fn",
                    "precision",
                    "recall",
                    "f1_score",
                    "far",
                    "frr",
                ],
            )
            writer.writeheader()
            for r in sweep_results:
                writer.writerow(asdict(r))
        print(f"[OK] Laporan tabel CSV disimpan ke: {output_csv}")

    return report_data


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluasi Threshold Face Matching (Biometrik Absensi) Berbasis Dataset Nyata",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Contoh Penggunaan:
  python -m scripts.evaluate_matching --dataset-dir ./dataset
  python -m scripts.evaluate_matching --dataset-dir ./dataset --mode gallery-probe --min-threshold 0.30 --max-threshold 0.70 --step 0.02
  python -m scripts.evaluate_matching --dataset-dir ./dataset --output-json report.json --output-csv report.csv
        """,
    )
    parser.add_argument(
        "--dataset-dir",
        type=str,
        default="./dataset",
        help="Path ke direktori dataset (default: ./dataset)",
    )
    parser.add_argument(
        "--min-threshold",
        type=float,
        default=0.20,
        help="Batas bawah sweep threshold (default: 0.20)",
    )
    parser.add_argument(
        "--max-threshold",
        type=float,
        default=0.80,
        help="Batas atas sweep threshold (default: 0.80)",
    )
    parser.add_argument(
        "--step",
        type=float,
        default=0.05,
        help="Step kenaikan threshold (default: 0.05)",
    )
    parser.add_argument(
        "--mode",
        choices=["pairwise", "gallery-probe"],
        default="pairwise",
        help="Mode perbandingan: 'pairwise' (semua pasangan) atau 'gallery-probe' (multi-sample gallery)",
    )
    parser.add_argument(
        "--gallery-size",
        type=int,
        default=2,
        help="Jumlah sample gallery per siswa untuk mode gallery-probe (default: 2)",
    )
    parser.add_argument(
        "--skip-quality-check",
        action="store_true",
        help="Lewati penolakan quality check (pakai jika ingin menguji foto dengan kualitas rendah)",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help="Path file output JSON untuk hasil evaluasi lengkap",
    )
    parser.add_argument(
        "--output-csv",
        type=str,
        default=None,
        help="Path file output CSV untuk tabel sweep threshold",
    )

    args = parser.parse_args()

    dataset_path = Path(args.dataset_dir)
    if not dataset_path.exists():
        print(f"\n[INFO] Direktori dataset '{args.dataset_dir}' belum ada.")
        print("Silakan siapkan dataset dengan struktur folder:")
        print("  dataset/")
        print("    student_001/")
        print("      photo1.jpg")
        print("      photo2.jpg")
        print("    student_002/")
        print("      photo1.jpg")
        print("      photo2.jpg")
        print("\nLihat dokumentasi lengkap di docs/EVALUATION-GUIDE.md")
        sys.exit(0)

    try:
        run_evaluation(
            dataset_dir=args.dataset_dir,
            min_threshold=args.min_threshold,
            max_threshold=args.max_threshold,
            step=args.step,
            mode=args.mode,
            gallery_size=args.gallery_size,
            skip_quality=args.skip_quality_check,
            output_json=args.output_json,
            output_csv=args.output_csv,
        )
    except Exception as exc:
        print(f"\n[ERROR] Evaluasi gagal: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
