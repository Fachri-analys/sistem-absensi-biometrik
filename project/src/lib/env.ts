import { z } from "zod";

/**
 * Sebelum perbaikan ini, validasi environment variable tersebar di banyak
 * file (auth.ts, camera-key.ts, redis.ts, object-storage.ts) dan masing-
 * masing baru melempar error saat FUNGSINYA DIPANGGIL PERTAMA KALI — artinya
 * aplikasi bisa saja start dengan sukses, terlihat sehat di health check,
 * lalu baru gagal beberapa jam kemudian saat ada request pertama yang
 * kebetulan menyentuh jalur kode dengan config yang hilang. Ini pengalaman
 * debugging yang buruk di production (gagal jauh dari akar masalahnya).
 *
 * Modul ini memvalidasi SEMUA environment variable wajib di satu tempat,
 * SEKALI, saat modul ini pertama kali di-import (yaitu efektif saat proses
 * mulai, karena modul manapun yang butuh salah satu nilai ini akan meng-
 * import dari sini). Kalau ada yang hilang/tidak valid, proses gagal start
 * dengan pesan yang jelas menyebutkan variabel mana yang bermasalah —
 * bukan error samar di tengah request user asli.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi."),
  REDIS_URL: z.string().min(1, "REDIS_URL wajib diisi."),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET wajib minimal 32 karakter (generate dengan `openssl rand -base64 48`)."),
  CAMERA_API_KEY_SALT: z
    .string()
    .min(32, "CAMERA_API_KEY_SALT wajib minimal 32 karakter."),
  FACE_MATCH_THRESHOLD_DEFAULT: z.coerce.number().min(0).max(1).default(0.4),
  FACE_MATCH_THRESHOLD_OVERRIDE: z.coerce.number().min(0).max(1).optional(),
  LOG_LEVEL: z.string().default("info"),
  OBJECT_STORAGE_ENDPOINT: z.string().min(1, "OBJECT_STORAGE_ENDPOINT wajib diisi."),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1, "OBJECT_STORAGE_ACCESS_KEY wajib diisi."),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1, "OBJECT_STORAGE_SECRET_KEY wajib diisi."),
  OBJECT_STORAGE_REGION: z.string().default("auto"),
  OBJECT_STORAGE_BUCKET_PHOTOS: z.string().default("absensi-student-photos"),
  OBJECT_STORAGE_BUCKET_REPORTS: z.string().default("absensi-reports"),
  OBJECT_STORAGE_BUCKET_ENROLLMENT_TEMP: z.string().default("absensi-enrollment-temp"),
  // face-service (Python, internal) — lihat face-service/README.md.
  // TIDAK diekspos ke internet, hanya dipanggil server-ke-server dari sini.
  FACE_SERVICE_URL: z.string().url("FACE_SERVICE_URL harus URL valid."),
  FACE_SERVICE_API_KEY: z
    .string()
    .min(32, "FACE_SERVICE_API_KEY wajib minimal 32 karakter — harus SAMA PERSIS dengan INTERNAL_SERVICE_KEY di face-service/.env."),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // Sengaja `throw` biasa (bukan lewat ApiError/lib lain) — ini terjadi di
    // luar konteks request HTTP mana pun (saat modul di-import), jadi harus
    // menghentikan proses secara langsung dan jelas, bukan dikemas jadi
    // response API.
    throw new Error(
      `Konfigurasi environment variable tidak valid:\n${issues}\n\n` +
        `Cek file .env terhadap .env.example untuk daftar lengkap.`
    );
  }

  return result.data;
}

export const env = loadEnv();
