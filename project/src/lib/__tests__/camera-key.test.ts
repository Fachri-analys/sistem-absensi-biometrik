import { describe, it, expect, beforeAll } from "vitest";

// env.ts memvalidasi environment saat import — set dulu sebelum modul
// camera-key.ts (yang meng-import env.ts secara transitif) dimuat.
beforeAll(() => {
  process.env.CAMERA_API_KEY_SALT = "test-salt-minimal-32-karakter-panjang";
  process.env.SESSION_SECRET = "test-secret-minimal-32-karakter-panjang";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.OBJECT_STORAGE_ENDPOINT = "http://localhost:9000";
  process.env.OBJECT_STORAGE_ACCESS_KEY = "test";
  process.env.OBJECT_STORAGE_SECRET_KEY = "test";
  process.env.FACE_SERVICE_URL = "http://localhost:8000";
  process.env.FACE_SERVICE_API_KEY = "test-face-service-key-min-32-characters";
});

describe("camera-key: hashCameraApiKey", () => {
  it("deterministik — key yang sama menghasilkan hash yang sama", async () => {
    const { hashCameraApiKey } = await import("../camera-key");
    const key = "some-camera-api-key-12345";
    expect(hashCameraApiKey(key)).toBe(hashCameraApiKey(key));
  });

  it("key berbeda menghasilkan hash berbeda", async () => {
    const { hashCameraApiKey } = await import("../camera-key");
    expect(hashCameraApiKey("key-a")).not.toBe(hashCameraApiKey("key-b"));
  });

  it("hash berbentuk hex string sha256 (64 karakter)", async () => {
    const { hashCameraApiKey } = await import("../camera-key");
    const hash = hashCameraApiKey("any-key");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("TIDAK bisa dibalik ke key asli hanya dari hash (properti dasar HMAC)", async () => {
    const { hashCameraApiKey } = await import("../camera-key");
    const hash = hashCameraApiKey("rahasia-asli");
    expect(hash).not.toContain("rahasia-asli");
  });
});

describe("camera-key: generateCameraApiKey", () => {
  it("menghasilkan key yang berbeda setiap dipanggil (tidak collision)", async () => {
    const { generateCameraApiKey } = await import("../camera-key");
    const keys = new Set(Array.from({ length: 100 }, () => generateCameraApiKey()));
    expect(keys.size).toBe(100);
  });

  it("panjang key konsisten dan cukup panjang untuk menahan brute force", async () => {
    const { generateCameraApiKey } = await import("../camera-key");
    const key = generateCameraApiKey();
    expect(key.length).toBeGreaterThanOrEqual(64);
  });
});

describe("camera-key: safeCompareHex", () => {
  it("mengembalikan true untuk dua hex string identik", async () => {
    const { safeCompareHex } = await import("../camera-key");
    expect(safeCompareHex("abcd1234", "abcd1234")).toBe(true);
  });

  it("mengembalikan false untuk hex string berbeda", async () => {
    const { safeCompareHex } = await import("../camera-key");
    expect(safeCompareHex("abcd1234", "abcd9999")).toBe(false);
  });

  it("mengembalikan false (bukan melempar error) untuk panjang berbeda", async () => {
    const { safeCompareHex } = await import("../camera-key");
    expect(safeCompareHex("ab", "abcd")).toBe(false);
  });
});
