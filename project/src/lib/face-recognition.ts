/**
 * docs/01-PRD.md OQ-PRD-01, docs/03-SAD.md OQ-SAD-01: vendor/engine face
 * recognition & liveness belum ditentukan. Aturan #5 mewajibkan abstraction
 * layer supaya penggantian vendor tidak menyentuh domain logic sama sekali.
 *
 * PERUBAHAN PENTING: interface ini awalnya cuma dirancang untuk kebutuhan
 * ENROLMENT (foto statis dari rapor — tidak butuh liveness sama sekali,
 * karena tidak ada "orang hidup" yang perlu dibuktikan saat itu). Setelah
 * dikonfirmasi bahwa presensi dilakukan siswa via HP PRIBADI MASING-MASING
 * (bukan kamera device tepercaya milik sekolah), liveness detection dan
 * PERBANDINGAN 1:1 (bukan cuma generate embedding) jadi kebutuhan nyata di
 * jalur presensi — ditambahkan sebagai method baru di sini.
 *
 * PENTING: embedding SELALU direpresentasikan sebagai `embeddingRef` (string
 * referensi ke penyimpanan terenkripsi), TIDAK PERNAH sebagai array angka
 * mentah yang beredar di business logic — perbandingan similarity dilakukan
 * di DALAM implementasi engine (compareEmbeddings), bukan di route handler.
 * ini konsisten dengan docs/06-SECURITY-SPEC.md: akses ke representasi
 * numerik wajah dibatasi seketat mungkin.
 *
 * PENTING: MockFaceRecognitionEngine di bawah ini (dipertahankan untuk
 * kebutuhan unit test yang tidak boleh memanggil service eksternal) BUKAN
 * lagi yang dipakai di produksi — lihat HttpFaceRecognitionEngine di bagian
 * bawah file ini, yang memanggil face-service (Python, InsightFace +
 * MiniFASNet — lihat face-service/README.md). Kalau vendor lain dipilih di
 * masa depan (OQ-PRD-01), cukup buat class baru yang mengimplementasikan
 * FaceRecognitionEngine yang sama dan ganti satu baris di
 * getFaceRecognitionEngine() — tidak ada perubahan lain yang dibutuhkan di
 * API routes atau worker.
 */

import { env } from "./env";

export type PhotoQualityReason =
  | "no_face"
  | "multiple_faces"
  | "face_too_small"
  | "image_too_blurry"
  | "poor_lighting"
  | "extreme_pose"
  | "face_cropped"
  | "invalid_image"
  | "NO_FACE_DETECTED"
  | "MULTIPLE_FACES"
  | "LOW_RESOLUTION"
  | "BLURRY";

export interface PhotoQualityResult {
  isValid: boolean;
  reason?: PhotoQualityReason | string;
}

export interface LivenessResult {
  passed: boolean;
  reason?: "NO_FACE_DETECTED" | "SPOOF_SUSPECTED" | "NO_MOTION_DETECTED" | "LOW_CONFIDENCE";
  confidence?: number;
}

export interface EmbeddingResult {
  embeddingRef: string; // referensi ke penyimpanan embedding TERENKRIPSI, bukan embedding mentah
  embeddingVersion: string;
}

export interface FaceRecognitionEngine {
  /** FR-ENROLL-003: validasi kualitas foto statis sebelum generate embedding (dipakai saat enrolment & presensi). */
  validatePhotoQuality(imageBuffer: Buffer): Promise<PhotoQualityResult>;

  /**
   * Deteksi liveness dari capture presensi (bukan enrolment — foto rapor
   * tidak butuh ini). `mediaBuffer` bisa berupa satu foto atau beberapa
   * frame berurutan tergantung metode liveness yang dipakai vendor
   * (mis. deteksi kedipan/gerakan butuh multi-frame, deteksi tekstur/depth
   * bisa cukup satu frame) — kontrak persis ditentukan oleh implementasi
   * vendor final, interface ini sengaja generik menerima keduanya.
   */
  checkLiveness(mediaBuffer: Buffer | Buffer[]): Promise<LivenessResult>;

  /** FR-ENROLL-004: generate embedding dari foto yang lolos validasi (enrolment MAUPUN presensi). */
  generateEmbedding(imageBuffer: Buffer): Promise<EmbeddingResult>;

  /**
   * Perbandingan 1:1 SATU live capture vs SATU template tersimpan — BUKAN
   * pencarian 1:N ke seluruh basis data siswa. Ini keputusan arsitektur
   * penting: karena siswa mengetik NISN-nya sendiri terlebih dulu, sistem
   * sudah tahu SIAPA yang diklaim, sehingga hanya perlu memverifikasi "apakah
   * wajah ini benar milik siswa itu" (1:1, murah & akurat) — bukan
   * mengidentifikasi "wajah ini milik siapa dari 840 siswa" (1:N, mahal &
   * rawan false-positive pada skala besar).
   */
  compareEmbeddings(liveEmbeddingRef: string, storedEmbeddingRef: string): Promise<number>;
}

/**
 * MOCK — implementasi tiruan untuk testing tanpa ketergantungan ke face-service.
 * Mendukung simulasi kualitas foto untuk verifikasi skenario kegagalan presensi/enrolment.
 */
export class MockFaceRecognitionEngine implements FaceRecognitionEngine {
  private customQualityResult?: PhotoQualityResult;

  constructor(customQualityResult?: PhotoQualityResult) {
    this.customQualityResult = customQualityResult;
  }

  setMockQualityResult(result: PhotoQualityResult | undefined): void {
    this.customQualityResult = result;
  }

  async validatePhotoQuality(imageBuffer: Buffer): Promise<PhotoQualityResult> {
    if (this.customQualityResult) {
      return this.customQualityResult;
    }
    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return { isValid: false, reason: "invalid_image" };
    }
    const MIN_SIZE_BYTES = 20 * 1024; // proxy kasar untuk "resolusi terlalu rendah"
    if (imageBuffer.byteLength < MIN_SIZE_BYTES) {
      return { isValid: false, reason: "invalid_image" };
    }
    return { isValid: true };
  }

  async checkLiveness(): Promise<LivenessResult> {
    return { passed: true, confidence: 1 };
  }

  async generateEmbedding(imageBuffer: Buffer): Promise<EmbeddingResult> {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(imageBuffer).digest("hex");
    return {
      embeddingRef: `mock:${hash}`,
      embeddingVersion: "mock-v0",
    };
  }

  async compareEmbeddings(liveEmbeddingRef: string, storedEmbeddingRef: string): Promise<number> {
    return liveEmbeddingRef === storedEmbeddingRef ? 1 : 0;
  }
}

let engineInstance: FaceRecognitionEngine | undefined;

export function getFaceRecognitionEngine(): FaceRecognitionEngine {
  if (!engineInstance) {
    // Menggantikan Mock — implementasi nyata yang memanggil face-service
    // (Python, InsightFace + MiniFASNet, lihat face-service/README.md).
    // Kalau vendor lain dipilih nanti (OQ-PRD-01), cukup buat class baru
    // yang mengimplementasikan FaceRecognitionEngine yang sama dan ganti
    // baris ini — tidak ada kode lain yang perlu diubah.
    engineInstance = new HttpFaceRecognitionEngine();
  }
  return engineInstance;
}

export function setFaceRecognitionEngine(engine?: FaceRecognitionEngine): void {
  engineInstance = engine;
}

export class FaceServiceError extends Error {
  public readonly reason?: string;

  constructor(
    public readonly statusCode: number,
    public readonly detail: string,
    public readonly path: string,
    reason?: string
  ) {
    super(`face-service ${path} gagal (${statusCode}): ${detail}`);
    this.name = "FaceServiceError";
    this.reason = reason;
  }
}

/**
 * Implementasi konkret yang memanggil face-service lewat HTTP internal.
 * Autentikasi via shared secret (X-Internal-Service-Key) — pola yang sama
 * dengan X-Camera-Key di lib/require-auth.ts: service-ke-service, bukan
 * untuk dipanggil browser/siswa langsung.
 */
class HttpFaceRecognitionEngine implements FaceRecognitionEngine {
  private async postMultipart<T>(path: string, imageBuffer: Buffer): Promise<T> {
    const formData = new FormData();
    // new Uint8Array(imageBuffer) — BUKAN langsung imageBuffer — karena tipe
    // Buffer Node (ArrayBufferLike yang mencakup kemungkinan SharedArrayBuffer)
    // tidak cocok persis dengan BlobPart di lib DOM TypeScript. Membungkus
    // jadi Uint8Array biasa menghasilkan salinan dengan ArrayBuffer konkret,
    // menyelesaikan mismatch tipe tanpa mengubah isi bytenya sama sekali.
    formData.append("photo", new Blob([new Uint8Array(imageBuffer)]), "photo.jpg");

    const response = await fetch(`${env.FACE_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "X-Internal-Service-Key": env.FACE_SERVICE_API_KEY },
      body: formData,
      // Timeout eksplisit — face-service tidak boleh menggantung request
      // presensi siswa tanpa batas kalau service itu sendiri bermasalah.
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let detail = body;
      let reason: string | undefined;
      try {
        const parsed = JSON.parse(body);
        if (parsed.detail) {
          if (typeof parsed.detail === "string") {
            detail = parsed.detail;
          } else if (typeof parsed.detail === "object" && parsed.detail !== null) {
            detail = JSON.stringify(parsed.detail);
            reason = parsed.detail.reason;
          }
        }
        if (!reason && parsed.reason) {
          reason = parsed.reason;
        }
      } catch {}
      throw new FaceServiceError(response.status, detail, path, reason);
    }

    return response.json() as Promise<T>;
  }

  async validatePhotoQuality(imageBuffer: Buffer): Promise<PhotoQualityResult> {
    const result = await this.postMultipart<{ is_valid: boolean; reason?: string }>(
      "/v1/quality",
      imageBuffer
    );
    return {
      isValid: result.is_valid,
      reason: result.reason as PhotoQualityResult["reason"],
    };
  }

  async checkLiveness(mediaBuffer: Buffer | Buffer[]): Promise<LivenessResult> {
    // face-service v0.1.0 baru menerima SATU foto (bukan multi-frame) —
    // lihat catatan di face-service/app/liveness_engine.py soal potensi
    // pengembangan multi-frame di masa depan. Kalau dikirim array, ambil
    // frame pertama saja untuk sekarang.
    const buffer = Array.isArray(mediaBuffer) ? mediaBuffer[0] : mediaBuffer;
    if (!buffer) {
      return { passed: false, reason: "NO_FACE_DETECTED" };
    }
    const result = await this.postMultipart<{
      passed: boolean;
      confidence: number;
      reason?: string;
    }>("/v1/liveness", buffer);
    return {
      passed: result.passed,
      confidence: result.confidence,
      reason: result.reason as LivenessResult["reason"],
    };
  }

  async generateEmbedding(imageBuffer: Buffer): Promise<EmbeddingResult> {
    const result = await this.postMultipart<{
      embedding_ref: string;
      embedding_version: string;
    }>("/v1/embedding", imageBuffer);
    return {
      embeddingRef: result.embedding_ref,
      embeddingVersion: result.embedding_version,
    };
  }

  async compareEmbeddings(liveEmbeddingRef: string, storedEmbeddingRef: string): Promise<number> {
    const response = await fetch(`${env.FACE_SERVICE_URL}/v1/compare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Service-Key": env.FACE_SERVICE_API_KEY,
      },
      body: JSON.stringify({
        live_embedding_ref: liveEmbeddingRef,
        stored_embedding_ref: storedEmbeddingRef,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let detail = body;
      try {
        const parsed = JSON.parse(body);
        if (parsed.detail) {
          detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {}
      throw new FaceServiceError(response.status, detail, "/v1/compare");
    }

    const result = (await response.json()) as { similarity: number };
    return result.similarity;
  }
}
