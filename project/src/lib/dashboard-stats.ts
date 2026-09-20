import { prisma } from "./prisma";
import { getSchoolDayRangeUtc, schoolLocalDateKey } from "./school-time";

/**
 * Logic agregasi statistik kehadiran hari ini, diekstrak ke satu tempat
 * supaya /api/dashboard/stats dan /api/attendance/today tidak menduplikasi
 * query yang sama dengan cara yang bisa diam-diam berbeda seiring waktu.
 *
 * "Hari ini" dihitung berdasarkan kalender WIB (lihat lib/school-time.ts),
 * BUKAN kalender UTC — sebelumnya kode ini memakai setUTCHours(0,0,0,0)
 * yang membuat batas hari bergeser ke jam 07:00 WIB (titik pergantian hari
 * UTC), sehingga presensi pagi sebelum jam 7 salah terhitung masuk hari
 * kemarin di statistik dashboard.
 */
export async function computeTodayAttendanceStats(effectiveClassId?: string) {
  const { start: todayStart, end: todayEnd } = getSchoolDayRangeUtc(new Date());

  const attendanceWhere = {
    recordedAt: { gte: todayStart, lt: todayEnd },
    ...(effectiveClassId ? { student: { classId: effectiveClassId } } : {}),
  };

  const totalStudentsWhere = effectiveClassId
    ? { classId: effectiveClassId, isActive: true, deletedAt: null }
    : { isActive: true, deletedAt: null };

  const [totalStudents, statusCounts] = await Promise.all([
    prisma.student.count({ where: totalStudentsWhere }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: attendanceWhere,
      _count: { _all: true },
    }),
  ]);

  const onTime = statusCounts.find((s) => s.status === "ON_TIME")?._count._all ?? 0;
  const late = statusCounts.find((s) => s.status === "LATE")?._count._all ?? 0;
  const manual = statusCounts.find((s) => s.status === "MANUAL")?._count._all ?? 0;
  const totalPresent = onTime + late + manual;

  return {
    totalStudents,
    onTime,
    late,
    absentOrUnrecorded: Math.max(totalStudents - totalPresent, 0),
  };
}

export function dashboardCacheKey(effectiveClassId?: string): string {
  return `dashboard:stats:${schoolLocalDateKey(new Date())}:${effectiveClassId ?? "all"}`;
}
