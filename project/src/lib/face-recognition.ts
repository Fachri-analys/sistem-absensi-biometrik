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
import { summarizeLiveness } from "./checkin-frame-policy";

export interface PhotoQualityResult {
  isValid: boolean;
  reason?: "NO_FACE_DETECTED" | "MULTIPLE_FACES" | "LOW_RESOLUTION" | "BLURRY";
}

export interface LivenessResult {
  passed: boolean;
  reason?:
    | "NO_FACE_DETECTED"
    | "MULTIPLE_FACES"
    | "INVALID_IMAGE"
    | "SPOOF_SUSPECTED"
    | "MODEL_NOT_CONFIGURED"
    | "INFERENCE_ERROR"
    | "NO_MOTION_DETECTED"
    | "LOW_CONFIDENCE";
  confidence?: number;
}

export interface EmbeddingResult {
  embeddingRef: string; // referensi ke penyimpanan embedding TERENKRIPSI, bukan embedding mentah
  embeddingVersion: string;
}

export interface FaceRecognitionEngine {
  /** FR-ENROLL-003: validasi kualitas foto statis sebelum generate embedding (dipakai saat enrolment). */
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
 * MOCK — bukan implementasi nyata. Menyimulasikan validasi dasar (ukuran
 * buffer sebagai proxy resolusi) dan menghasilkan embeddingRef placeholder
 * yang deterministik dari hash konten foto (BUKAN embedding wajah asli).
 */
export class MockFaceRecognitionEngine implements FaceRecognitionEngine {
  async validatePhotoQuality(imageBuffer: Buffer): Promise<PhotoQualityResult> {
    const MIN_SIZE_BYTES = 20 * 1024; // proxy kasar untuk "resolusi terlalu rendah"
    if (imageBuffer.byteLength < MIN_SIZE_BYTES) {
      return { isValid: false, reason: "LOW_RESOLUTION" };
    }
    // TODO(vendor): ganti dengan deteksi wajah nyata begitu engine final dipilih.
    return { isValid: true };
  }

  async checkLiveness(): Promise<LivenessResult> {
    // Fail closed: mock tidak boleh mensimulasikan liveness yang lolos,
    // karena itu akan membuat test/mock engine terlihat seperti proteksi
    // anti-spoofing yang nyata.
    return { passed: false, confidence: 0, reason: "MODEL_NOT_CONFIGURED" };
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
    // Mock super-naif: embedding "cocok sempurna" hanya jika hash foto
    // PERSIS SAMA — dalam mock ini TIDAK PERNAH akan cocok untuk dua foto
    // berbeda (bahkan dari orang yang sama), karena mock tidak benar-benar
    // memahami wajah. INI HANYA UNTUK MEMBUKTIKAN PIPELINE END-TO-END
    // BERFUNGSI (request tervalidasi, tersimpan, dsb) — bukan untuk menguji
    // akurasi pengenalan wajah, yang baru bisa diuji dengan engine vendor asli.
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

export class FaceServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly detail: string,
    public readonly path: string
  ) {
    super(`face-service ${path} gagal (${statusCode}): ${detail}`);
    this.name = "FaceServiceError";
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
      try {
        const parsed = JSON.parse(body);
        if (parsed.detail) {
          detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {}
      throw new FaceServiceError(response.status, detail, path);
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
    // MiniFASNet melakukan inferensi satu frame per request. Jika capture
    // berisi beberapa frame, semua frame diproses dan liveness memakai quorum
    // yang sama dengan kebijakan konsistensi check-in.
    const frames = Array.isArray(mediaBuffer) ? mediaBuffer : [mediaBuffer];
    if (frames.length === 0) {
      return { passed: false, reason: "NO_FACE_DETECTED" };
    }
    const results = await Promise.all(
      frames.map(async (buffer) => {
        try {
          const result = await this.postMultipart<{
            passed: boolean;
            confidence: number;
            reason?: string;
          }>("/v1/liveness", buffer);
          return {
            passed: result.passed,
            confidence: result.confidence,
            reason: result.reason,
          };
        } catch (err) {
          // A malformed frame or a frame without exactly one face is filtered
          // out of the liveness quorum; infrastructure/model failures still
          // propagate and fail the request instead of being hidden.
          if (err instanceof FaceServiceError && (err.statusCode === 400 || err.statusCode === 422)) {
            return { passed: false, confidence: 0, reason: "INVALID_IMAGE" };
          }
          throw err;
        }
      })
    );
    const summary = summarizeLiveness(
      results,
      Array.isArray(mediaBuffer) ? env.CHECKIN_MIN_CONSISTENT_FRAMES : 1
    );
    return {
      passed: summary.passed,
      confidence: summary.confidence,
      reason: summary.reason as LivenessResult["reason"],
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
