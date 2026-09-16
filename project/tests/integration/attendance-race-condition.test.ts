import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { PrismaClient, Prisma } from "@prisma/client";

/**
 * TC-ATT-003 (docs/10-TEST-PLAN.md) — "Simultaneous attendance (banyak
 * siswa bersamaan)". Ini test PALING PENTING yang sebelumnya ditandai
 * "belum dijalankan" di docs/10-TEST-PLAN.md §4 — unit test murni tidak
 * bisa membuktikan ini karena PrismaClient di-mock di sana; race condition
 * hanya nyata kalau dua request betul-betul mengenai constraint database
 * yang sama secara bersamaan, yang cuma bisa diuji lawan PostgreSQL asli.
 *
 * KENAPA TESTCONTAINERS (bukan mock): tujuan test ini SPESIFIK membuktikan
 * bahwa `@@unique([studentId, attendanceDate])` di schema.prisma benar-benar
 * ditegakkan oleh PostgreSQL di bawah tekanan konkurensi — sesuatu yang
 * tidak bisa dibuktikan tanpa database sungguhan. Container Postgres
 * ephemeral dibuat & dihancurkan otomatis per test run, tidak menyentuh
 * database development/production manapun.
 *
 * CATATAN JUJUR: test ini ditulis dan diverifikasi BENAR SECARA LOGIKA,
 * TAPI belum pernah benar-benar dijalankan sampai selesai — lingkungan
 * pengembangan tidak punya Docker daemon (dibutuhkan Testcontainers untuk
 * start container Postgres). Jalankan `npm run test:integration` di mesin
 * dengan Docker terpasang untuk verifikasi sesungguhnya. Kalau ada
 * kegagalan yang berasal dari test setup ini sendiri (bukan dari bug di
 * kode aplikasi), kemungkinan besar penyebabnya ada di sini, bukan di
 * logic race-condition yang diuji.
 */

describe("Race condition: presensi bersamaan untuk siswa yang sama", () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let studentId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    // `db push` (bukan `migrate deploy`) — cukup untuk test ephemeral yang
    // tidak butuh riwayat migrasi, cuma butuh schema akhir diterapkan.
    execSync("npx prisma db push --skip-generate", {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });

    // Seed data minimal — satu major, satu class, satu student, satu
    // attendance_setting default. cameraId TIDAK dibuat — test ini
    // spesifik menguji channel STUDENT_PHONE (jalur presensi utama), yang
    // memang tidak melibatkan tabel cameras sama sekali (cameraId: null).
    const major = await prisma.major.create({ data: { name: "Rekayasa Perangkat Lunak", code: "RPL" } });
    const cls = await prisma.class.create({ data: { name: "XII RPL 1", majorId: major.id } });
    const student = await prisma.student.create({
      data: { nisn: "1234567890", fullName: "Siswa Uji Konkurensi", classId: cls.id },
    });
    studentId = student.id;

    await prisma.attendanceSetting.create({
      data: { classId: null, checkInStartMinutes: 420, checkInLateAfterMinutes: 435, matchThreshold: 0.9 },
    });
  }, 120_000); // container pull + start + schema push bisa beberapa puluh detik

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it(
    "hanya SATU dari banyak percobaan presensi bersamaan (hari sekolah sama) yang berhasil tersimpan",
    async () => {
      const CONCURRENT_ATTEMPTS = 20;
      const recordedAt = new Date("2026-09-14T00:05:00.000Z"); // 07:05 WIB, satu hari sekolah yang sama untuk semua percobaan
      const attendanceDate = new Date(Date.UTC(2026, 8, 13, 17, 0, 0, 0)); // hasil schoolAttendanceDateValue untuk instant di atas (00:00 WIB 14 Sept = 17:00 UTC 13 Sept)

      // Simulasikan N kejadian "berbeda" (idempotencyKey unik per percobaan,
      // seolah-olah N kali scan terpisah) — BUKAN retry dengan key yang
      // sama (itu skenario idempotency biasa, sudah diuji lewat unit test
      // parseOrThrow/validation). Yang diuji di sini murni kemampuan
      // constraint (studentId, attendanceDate) menahan duplikat walau
      // idempotencyKey-nya berbeda-beda.
      const attempts = Array.from({ length: CONCURRENT_ATTEMPTS }, (_, i) =>
        prisma.attendance
          .create({
            data: {
              studentId,
              cameraId: null,
              channel: "STUDENT_PHONE",
              matchScore: 0.95,
              livenessPassed: true,
              status: "ON_TIME",
              recordedAt,
              attendanceDate,
              idempotencyKey: `race-test-${i}-${Date.now()}-${Math.random()}`,
            },
          })
          .then(() => ({ ok: true as const }))
          .catch((err: unknown) => {
            const isUniqueViolation =
              err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
            return { ok: false as const, isUniqueViolation, error: err };
          })
      );

      const results = await Promise.all(attempts);

      const succeeded = results.filter((r) => r.ok);
      const failedWithUniqueViolation = results.filter((r) => !r.ok && r.isUniqueViolation);
      const failedOther = results.filter((r) => !r.ok && !r.isUniqueViolation);

      // Ini assertion INTI dari test ini: TEPAT SATU yang berhasil, sisanya
      // ditolak PostgreSQL sendiri lewat unique constraint — bukan
      // kebetulan salah satu menang karena timing, tapi karena database
      // secara struktural tidak mengizinkan baris kedua.
      expect(succeeded.length).toBe(1);
      expect(failedWithUniqueViolation.length).toBe(CONCURRENT_ATTEMPTS - 1);
      expect(failedOther.length).toBe(0); // tidak ada kegagalan TAK TERDUGA (selain unique violation yang memang diharapkan)

      const rowsInDb = await prisma.attendance.count({ where: { studentId, attendanceDate } });
      expect(rowsInDb).toBe(1); // konfirmasi independen langsung dari database, bukan cuma dari hasil Promise.all
    },
    30_000
  );

  it("idempotencyKey yang SAMA (simulasi retry jaringan) juga cuma menghasilkan satu baris", async () => {
    const sharedIdempotencyKey = `retry-test-${Date.now()}`;
    const recordedAt = new Date("2026-09-15T00:05:00.000Z");
    const attendanceDate = new Date(Date.UTC(2026, 8, 14, 17, 0, 0, 0));

    const attempts = Array.from({ length: 10 }, () =>
      prisma.attendance
        .create({
          data: {
            studentId,
            cameraId: null,
            channel: "STUDENT_PHONE",
            matchScore: 0.95,
            livenessPassed: true,
            status: "ON_TIME",
            recordedAt,
            attendanceDate,
            idempotencyKey: sharedIdempotencyKey, // SENGAJA sama di semua percobaan
          },
        })
        .then(() => ({ ok: true as const }))
        .catch((err: unknown) => ({
          ok: false as const,
          isUniqueViolation: err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002",
        }))
    );

    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => r.ok);

    expect(succeeded.length).toBe(1);

    const rowsInDb = await prisma.attendance.count({ where: { idempotencyKey: sharedIdempotencyKey } });
    expect(rowsInDb).toBe(1);
  });
});
