import { z } from "zod";
import { Errors } from "./api-errors";

/**
 * Semua endpoint mutasi WAJIB divalidasi sebelum menyentuh database
 * (docs/02-SRS.md §17 Error Handling, docs/06-SECURITY-SPEC.md §API Security).
 * Skema di sini adalah satu-satunya sumber kebenaran bentuk request — jangan
 * duplikasi validasi manual di dalam route handler.
 */

export const loginSchema = z
  .object({
    email: z.string().email("Format email tidak valid.").optional(),
    identifier: z.string().trim().min(1, "NISN, NIP, atau Email wajib diisi.").optional(),
    password: z.string().min(1, "Password wajib diisi."),
    role: z.enum(["siswa", "guru", "admin"]).optional(),
  })
  .refine((data) => Boolean(data.email || data.identifier), {
    message: "Email atau identifier wajib diisi.",
    path: ["identifier"],
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const studentListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  classId: z.string().uuid().optional(),
  majorId: z.string().uuid().optional(),
});

// NISN Indonesia: 10 digit numerik.
export const nisnSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "NISN harus terdiri dari 10 digit angka.");

export const createStudentSchema = z.object({
  nisn: nisnSchema,
  fullName: z.string().trim().min(2).max(150),
  classId: z.string().uuid("classId tidak valid."),
  gender: z.enum(["L", "P"]).optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

export const createClassSchema = z.object({
  name: z.string().trim().min(1).max(50),
  majorId: z.string().uuid("majorId tidak valid."),
  homeroomTeacherId: z.string().uuid().optional(),
});

export const updateClassSchema = createClassSchema.partial();

export const createMajorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(20),
});

export const createCameraSchema = z.object({
  name: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(150),
});

export const updateCameraSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  location: z.string().trim().min(2).max(150).optional(),
  status: z.enum(["ONLINE", "OFFLINE"]).optional(),
  resolution: z.string().trim().max(30).optional(),
  fps: z.coerce.number().int().min(1).max(240).optional(),
  regenerateKey: z.boolean().optional(),
});

const isoDateString = z.string().datetime({ message: "Format waktu harus ISO 8601." });

export const createAttendanceSchema = z.object({
  studentId: z.string().uuid("studentId tidak valid."),
  matchScore: z.number().min(0).max(1),
  livenessPassed: z.boolean(),
  recordedAt: isoDateString,
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const attendanceListQuerySchema = paginationSchema.extend({
  classId: z.string().uuid().optional(),
  status: z.enum(["ON_TIME", "LATE", "MANUAL"]).optional(),
  dateFrom: isoDateString.optional(),
  dateTo: isoDateString.optional(),
  search: z.string().trim().max(100).optional(),
});

export const exportReportSchema = z.object({
  type: z.literal("ATTENDANCE_EXPORT"),
  filter: z.object({
    classId: z.string().uuid().optional(),
    dateFrom: isoDateString,
    dateTo: isoDateString,
  }),
});

/** Helper: parse dengan Zod, lempar ApiError 400 (bukan exception mentah) jika gagal. */
/**
 * Helper: parse dengan Zod, lempar ApiError 400 (bukan exception mentah) jika gagal.
 *
 * CATATAN TEKNIS PENTING: parameter di-tipe sebagai `z.ZodType<T, z.ZodTypeDef, any>`
 * — BUKAN `z.ZodSchema<T>` — dengan sengaja. `ZodSchema<T>` secara default juga
 * mengikat generic ke posisi "Input" schema (bukan cuma "Output"). Untuk field
 * dengan `.default(...)` atau `.coerce...`, tipe Input berbeda dari Output
 * (Input mengizinkan `undefined`/string mentah, Output sudah pasti `number`
 * setelah default/coercion diterapkan). Kalau parameter tetap `ZodSchema<T>`,
 * TypeScript bisa salah meng-infer T dari sisi Input, sehingga field seperti
 * `page`/`pageSize` (yang punya `.default(1)`) muncul sebagai `number | undefined`
 * di pemanggil — padahal setelah `safeParse` sukses, nilainya SELALU `number`.
 * Mengunci slot Input ke `any` di sini memastikan T hanya diinfer dari Output.
 */
export function parseOrThrow<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.flatten().fieldErrors;
    throw Errors.validation(details);
  }
  return result.data;
}
