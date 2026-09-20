import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-minimal-32-karakter-panjang";
  process.env.CAMERA_API_KEY_SALT = "test-salt-minimal-32-karakter-panjang";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.OBJECT_STORAGE_ENDPOINT = "http://localhost:9000";
  process.env.OBJECT_STORAGE_ACCESS_KEY = "test";
  process.env.OBJECT_STORAGE_SECRET_KEY = "test";
  process.env.FACE_SERVICE_URL = "http://localhost:8000";
  process.env.FACE_SERVICE_API_KEY = "test-face-service-key-min-32-characters";
});

describe("Face Quality Pipeline & Engine Contracts", () => {
  it("MockFaceRecognitionEngine menolak gambar kosong dengan invalid_image", async () => {
    const { MockFaceRecognitionEngine } = await import("../face-recognition");
    const engine = new MockFaceRecognitionEngine();

    const result = await engine.validatePhotoQuality(Buffer.alloc(0));
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("invalid_image");
  });

  it("MockFaceRecognitionEngine menolak buffer terlalu kecil sebagai invalid_image", async () => {
    const { MockFaceRecognitionEngine } = await import("../face-recognition");
    const engine = new MockFaceRecognitionEngine();

    const smallBuffer = Buffer.alloc(100); // 100 bytes < 20KB
    const result = await engine.validatePhotoQuality(smallBuffer);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("invalid_image");
  });

  it("MockFaceRecognitionEngine meloloskan foto dengan ukuran memadai", async () => {
    const { MockFaceRecognitionEngine } = await import("../face-recognition");
    const engine = new MockFaceRecognitionEngine();

    const goodBuffer = Buffer.alloc(25 * 1024); // 25KB >= 20KB
    const result = await engine.validatePhotoQuality(goodBuffer);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("mendukung simulasi seluruh alasan penolakan kualitas wajah", async () => {
    const { MockFaceRecognitionEngine } = await import("../face-recognition");
    const reasons = [
      "no_face",
      "multiple_faces",
      "face_too_small",
      "image_too_blurry",
      "poor_lighting",
      "extreme_pose",
      "face_cropped",
      "invalid_image",
    ] as const;

    for (const reason of reasons) {
      const engine = new MockFaceRecognitionEngine({ isValid: false, reason });
      const result = await engine.validatePhotoQuality(Buffer.alloc(50 * 1024));
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(reason);
    }
  });

  it("FaceServiceError menyimpan statusCode, detail, dan reason terstruktur", async () => {
    const { FaceServiceError } = await import("../face-recognition");
    const error = new FaceServiceError(
      422,
      JSON.stringify({ error: "QUALITY_CHECK_FAILED", reason: "image_too_blurry" }),
      "/v1/embedding",
      "image_too_blurry"
    );

    expect(error.statusCode).toBe(422);
    expect(error.path).toBe("/v1/embedding");
    expect(error.reason).toBe("image_too_blurry");
    expect(error.message).toContain("face-service /v1/embedding gagal (422)");
  });
});
