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

describe("validation: parseOrThrow generic inference fix", () => {
  it("page/pageSize hasil parse adalah number asli (bukan string), default terisi benar", async () => {
    const { parseOrThrow, studentListQuerySchema } = await import("../validation");
    // Simulasikan Object.fromEntries(url.searchParams) — semua value string,
    // sesuai bentuk data mentah dari query string HTTP asli.
    const result = parseOrThrow(studentListQuerySchema, {});

    expect(typeof result.page).toBe("number");
    expect(typeof result.pageSize).toBe("number");
    expect(result.page).toBe(1); // default
    expect(result.pageSize).toBe(20); // default

    // Ini baris yang tadinya gagal type-check sebelum fix (number|undefined
    // tidak bisa diassign ke number) — kalau baris ini compile, fix-nya benar.
    const pageAsNumber: number = result.page;
    expect(pageAsNumber).toBe(1);
  });

  it("coercion dari string query param ('3') menjadi number asli (3)", async () => {
    const { parseOrThrow, studentListQuerySchema } = await import("../validation");
    const result = parseOrThrow(studentListQuerySchema, { page: "3", pageSize: "50" });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it("melempar ApiError 400 (bukan exception Zod mentah) untuk input tidak valid", async () => {
    const { parseOrThrow, createStudentSchema } = await import("../validation");
    const { ApiError } = await import("../api-errors");

    expect(() => parseOrThrow(createStudentSchema, { nisn: "123" })).toThrow(ApiError);
  });
});

describe("validation: NISN format", () => {
  it("menerima NISN 10 digit", async () => {
    const { createStudentSchema } = await import("../validation");
    const result = createStudentSchema.safeParse({
      nisn: "0058291032",
      fullName: "Test Siswa",
      classId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("menolak NISN kurang dari 10 digit", async () => {
    const { createStudentSchema } = await import("../validation");
    const result = createStudentSchema.safeParse({
      nisn: "12345",
      fullName: "Test Siswa",
      classId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("menolak NISN dengan karakter non-digit", async () => {
    const { createStudentSchema } = await import("../validation");
    const result = createStudentSchema.safeParse({
      nisn: "12345ABCDE",
      fullName: "Test Siswa",
      classId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("trim spasi di sekitar NISN sebelum validasi", async () => {
    const { createStudentSchema } = await import("../validation");
    const result = createStudentSchema.safeParse({
      nisn: "  0058291032  ",
      fullName: "Test Siswa",
      classId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nisn).toBe("0058291032");
  });
});

describe("validation: pagination bounds", () => {
  it("menolak pageSize di atas 100 (mencegah client menarik seluruh tabel sekaligus)", async () => {
    const { paginationSchema } = await import("../validation");
    const result = paginationSchema.safeParse({ pageSize: "1000" });
    expect(result.success).toBe(false);
  });

  it("menolak page 0 atau negatif", async () => {
    const { paginationSchema } = await import("../validation");
    expect(paginationSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: "-5" }).success).toBe(false);
  });
});

describe("validation: createAttendanceSchema", () => {
  it("menolak matchScore di luar rentang 0-1", async () => {
    const { createAttendanceSchema } = await import("../validation");
    const base = {
      studentId: "550e8400-e29b-41d4-a716-446655440000",
      livenessPassed: true,
      recordedAt: new Date().toISOString(),
      idempotencyKey: "cam1-student1-20260912070000",
    };
    expect(createAttendanceSchema.safeParse({ ...base, matchScore: 1.5 }).success).toBe(false);
    expect(createAttendanceSchema.safeParse({ ...base, matchScore: -0.1 }).success).toBe(false);
    expect(createAttendanceSchema.safeParse({ ...base, matchScore: 0.95 }).success).toBe(true);
  });

  it("menolak idempotencyKey yang terlalu pendek", async () => {
    const { createAttendanceSchema } = await import("../validation");
    const result = createAttendanceSchema.safeParse({
      studentId: "550e8400-e29b-41d4-a716-446655440000",
      matchScore: 0.95,
      livenessPassed: true,
      recordedAt: new Date().toISOString(),
      idempotencyKey: "short",
    });
    expect(result.success).toBe(false);
  });
});
