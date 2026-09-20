import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { env } from "./env";

// resolveAttendanceStatus (logic murni, tanpa I/O) sekarang didefinisikan
// di school-time.ts dan di-re-export di sini untuk kompatibilitas import
// yang sudah ada (`@/lib/attendance-settings`) — lihat komentar di
// school-time.ts untuk alasan pemisahannya (testability: modul ini
// meng-import Prisma Client di level atas, school-time.ts tidak).
export { resolveAttendanceStatus } from "./school-time";

/**
 * docs/04-ERD.md (attendance_settings), docs/02-SRS.md NFR-ACC-001, FR-ATTENDANCE-004.
 *
 * attendance_settings.classId = null berarti "default sekolah". Kelas
 * tertentu bisa override lewat baris dengan classId terisi. Fungsi ini
 * menyatukan logic "kelas override, kalau tidak ada pakai default" di satu
 * tempat — supaya tidak ada endpoint lain yang diam-diam menduplikasi logic
 * ini dengan cara berbeda.
 *
 * checkInStartMinutes/checkInLateAfterMinutes adalah menit sejak tengah
 * malam WIB (lihat src/lib/school-time.ts) — BUKAN kolom TIME database,
 * untuk menghindari ambiguitas timezone driver (lihat komentar di
 * schema.prisma pada model AttendanceSetting).
 */

export interface EffectiveAttendanceSetting {
  matchThreshold: number;
  checkInStartMinutes: number;
  checkInLateAfterMinutes: number;
}

const DEFAULT_THRESHOLD = env.FACE_MATCH_THRESHOLD_DEFAULT;

export async function getEffectiveAttendanceSetting(
  classId: string
): Promise<EffectiveAttendanceSetting> {
  // Satu query dengan OR — bukan dua query terpisah (kelas dulu, baru default
  // jika kosong) — Prisma tidak mendukung "ambil salah satu prioritas" native,
  // jadi kita ambil keduanya sekaligus (paling banyak 2 baris) lalu pilih di
  // memori. Tetap satu round-trip DB.
  const settings = await prisma.attendanceSetting.findMany({
    where: { OR: [{ classId }, { classId: null }] },
    orderBy: { classId: "desc" }, // baris dengan classId terisi (non-null) duluan
    take: 2,
  });

  const classSpecific = settings.find((s) => s.classId === classId);
  const schoolDefault = settings.find((s) => s.classId === null);
  const effective = classSpecific ?? schoolDefault;

  if (!effective) {
    // Tidak ada konfigurasi sama sekali (belum di-setup admin) — pakai nilai
    // aman dari environment daripada gagal keras, tapi dengan jadwal yang
    // jelas tidak masuk akal (menit 0 = tengah malam WIB) supaya OPERATOR
    // sadar harus setup jadwal, bukan diam-diam menganggap semua ON_TIME.
    return {
      matchThreshold: DEFAULT_THRESHOLD,
      checkInStartMinutes: 0,
      checkInLateAfterMinutes: 0,
    };
  }

  return {
    matchThreshold: new Prisma.Decimal(effective.matchThreshold).toNumber(),
    checkInStartMinutes: effective.checkInStartMinutes,
    checkInLateAfterMinutes: effective.checkInLateAfterMinutes,
  };
}
