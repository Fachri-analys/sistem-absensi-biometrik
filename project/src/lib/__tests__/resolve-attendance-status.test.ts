import { describe, it, expect } from "vitest";
import { resolveAttendanceStatus } from "../school-time";

/**
 * Test ini SENGAJA import langsung dari school-time.ts (bukan dari
 * attendance-settings.ts) — resolveAttendanceStatus adalah fungsi murni
 * tanpa I/O, dan test murni tidak boleh butuh Prisma Client/database
 * apa pun untuk berjalan. Lihat komentar di school-time.ts untuk kenapa
 * fungsi ini sengaja dipisah dari attendance-settings.ts.
 */

describe("resolveAttendanceStatus", () => {
  it("presensi jam 06:50 WIB, batas terlambat 07:15 WIB → ON_TIME", async () => {
    
    const setting = { matchThreshold: 0.9, checkInStartMinutes: 420, checkInLateAfterMinutes: 435 };
    const recordedAt = new Date("2026-09-11T23:50:00.000Z"); // 06:50 WIB
    expect(resolveAttendanceStatus(recordedAt, setting)).toBe("ON_TIME");
  });

  it("presensi jam 07:20 WIB, batas terlambat 07:15 WIB → LATE", async () => {
    
    const setting = { matchThreshold: 0.9, checkInStartMinutes: 420, checkInLateAfterMinutes: 435 };
    const recordedAt = new Date("2026-09-12T00:20:00.000Z"); // 07:20 WIB
    expect(resolveAttendanceStatus(recordedAt, setting)).toBe("LATE");
  });

  it("tepat di batas waktu (07:15 WIB persis) masih dianggap ON_TIME (bukan strictly-greater)", async () => {
    
    const setting = { matchThreshold: 0.9, checkInStartMinutes: 420, checkInLateAfterMinutes: 435 };
    const recordedAt = new Date("2026-09-12T00:15:00.000Z"); // 07:15 WIB tepat
    expect(resolveAttendanceStatus(recordedAt, setting)).toBe("ON_TIME");
  });

  it("REGRESI BUG UTAMA: presensi 06:30 WIB tidak boleh salah dihitung LATE akibat batas UTC", async () => {
    // Sebelum fix WIB, kode lama membandingkan getUTCHours() langsung —
    // 06:30 WIB = 23:30 UTC, yang kalau dibandingkan naif terhadap
    // "checkInLateAfter jam 07:15" (disimpan sebagai Date/TIME) bisa
    // menghasilkan perbandingan yang salah tergantung bagaimana driver
    // membaca kolom TIME. Test ini mengunci bahwa sekarang perbandingan
    // murni berbasis menit-WIB, tidak bergantung representasi TIME database.
    
    const setting = { matchThreshold: 0.9, checkInStartMinutes: 420, checkInLateAfterMinutes: 435 };
    const recordedAt = new Date("2026-09-11T23:30:00.000Z"); // 06:30 WIB
    expect(resolveAttendanceStatus(recordedAt, setting)).toBe("ON_TIME");
  });
});
