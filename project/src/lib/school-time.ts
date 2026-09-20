/**
 * BUG YANG DIPERBAIKI FILE INI: seluruh kode sebelumnya menghitung "hari ini"
 * memakai batas hari UTC (`setUTCHours(0,0,0,0)`, `Date.UTC(...)`,
 * `toISOString().slice(0,10)`). Sekolah beroperasi di WIB (UTC+7), dan jam
 * masuk sekolah (~06:30-07:00 WIB) berada SEBELUM titik di mana hari UTC
 * berganti (07:00 WIB = 00:00 UTC). Akibatnya siswa yang presensi sebelum
 * jam 7 pagi WIB akan salah terhitung masuk ke HARI KEMARIN secara UTC —
 * salah di statistik dashboard, salah di cache key (data basi ter-serve),
 * dan yang paling serius: salah di constraint unique
 * `@@unique([studentId, attendanceDate])` (lihat schema.prisma) yang
 * menegakkan "satu presensi valid per hari" — dengan bug ini, constraint
 * tersebut sebenarnya menegakkan "satu presensi per hari UTC", bukan per
 * hari sekolah yang sebenarnya.
 *
 * WIB dipakai sebagai konstanta tetap (bukan IANA timezone lookup) karena:
 * (a) Indonesia tidak menerapkan DST, jadi offset tetap +7 selalu benar
 *     untuk WIB, dan (b) sekolah ini beroperasi di satu zona waktu tunggal
 *     (Jakarta). Kalau sistem ini nanti dipakai sekolah di WITA/WIT
 *     (Phase 3+, multi-tenant), offset ini perlu jadi konfigurasi per
 *     sekolah, bukan konstanta global — ditandai sebagai catatan desain,
 *     bukan diselesaikan sekarang karena di luar cakupan saat ini.
 */

export const SCHOOL_TIMEZONE_OFFSET_MINUTES = 7 * 60; // WIB = UTC+7, tanpa DST

/** Konversi instant UTC manapun ke "menit sejak tengah malam" dalam waktu sekolah (WIB). */
export function minutesSinceMidnightSchoolTime(date: Date): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return ((utcMinutes + SCHOOL_TIMEZONE_OFFSET_MINUTES) % (24 * 60) + 24 * 60) % (24 * 60);
}

/**
 * Kunci tanggal (YYYY-MM-DD) berdasarkan kalender WIB, BUKAN kalender UTC.
 * Dipakai untuk cache key dan label — bukan untuk query rentang database
 * (pakai getSchoolDayRangeUtc untuk itu, lihat di bawah).
 */
export function schoolLocalDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + SCHOOL_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Rentang [start, end) dalam instant UTC yang merepresentasikan SATU hari
 * kalender WIB yang memuat `referenceInstant`. Dipakai untuk query database
 * (`recordedAt: { gte: start, lt: end }`) — hasilnya adalah Date UTC biasa
 * yang aman dibandingkan langsung dengan kolom timestamptz manapun,
 * terlepas dari timezone server/driver database.
 */
export function getSchoolDayRangeUtc(referenceInstant: Date): { start: Date; end: Date } {
  const shifted = new Date(referenceInstant.getTime() + SCHOOL_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = shifted.getUTCMonth();
  const dd = shifted.getUTCDate();

  // Titik tengah malam WIB, dinyatakan sebagai instant UTC (mundur 7 jam
  // dari tengah malam WIB = 17:00 UTC hari sebelumnya).
  const startUtc = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0, 0) - SCHOOL_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  return { start: startUtc, end: endUtc };
}

/**
 * "Tanggal" (tanpa jam) untuk kolom `attendance.attendance_date` (`@db.Date`)
 * — dikembalikan sebagai instant UTC pada titik tengah malam WIB, konsisten
 * dengan getSchoolDayRangeUtc().start, sehingga satu kejadian presensi dan
 * query rentang hari yang sama selalu menunjuk ke nilai yang identik.
 */
export function schoolAttendanceDateValue(referenceInstant: Date): Date {
  return getSchoolDayRangeUtc(referenceInstant).start;
}

/**
 * Menentukan ON_TIME vs LATE berdasarkan jam kejadian (dikonversi ke WIB)
 * dibanding batas waktu efektif kelas. Fungsi PURA-PURA MURNI (tanpa I/O)
 * sengaja ditaruh di sini (school-time.ts), BUKAN di attendance-settings.ts
 * — meski secara nama terasa lebih "pas" di sana. Alasannya: attendance-
 * settings.ts juga berisi getEffectiveAttendanceSetting() yang meng-import
 * Prisma Client di level modul. Kalau resolveAttendanceStatus ada di file
 * yang sama, meng-importnya di unit test (yang seharusnya tidak butuh
 * database sama sekali) ikut memicu inisialisasi PrismaClient secara
 * transitif — ditemukan langsung saat menulis test untuk fungsi ini.
 * Memisahkan logic murni dari logic yang menyentuh I/O ke modul berbeda
 * bukan sekadar rapi-rapi kode, tapi syarat supaya unit test murni benar-
 * benar bisa berjalan tanpa dependency yang tidak relevan.
 */
export function resolveAttendanceStatus(
  recordedAt: Date,
  setting: { checkInLateAfterMinutes: number }
): "ON_TIME" | "LATE" {
  const recordedMinutes = minutesSinceMidnightSchoolTime(recordedAt);
  return recordedMinutes > setting.checkInLateAfterMinutes ? "LATE" : "ON_TIME";
}
