import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { resolveClassScopeOrThrow } from "@/lib/scope";
import { withCacheFallback } from "@/lib/redis";
import { computeTodayAttendanceStats } from "@/lib/dashboard-stats";
import { getSchoolDayRangeUtc, schoolLocalDateKey } from "@/lib/school-time";
export const dynamic = "force-dynamic";


const TODAY_STATS_TTL_SECONDS = 30; // docs/08-CACHE-SPEC.md: dashboard:stats TTL 30 detik

/**
 * GET /api/attendance/today (FR-ATTENDANCE-005)
 *
 * ANTI N+1 PENTING: statistik dihitung dengan groupBy (satu query agregasi,
 * lihat computeTodayAttendanceStats), BUKAN dengan mengambil semua record
 * lalu menghitung di JavaScript, dan BUKAN dengan banyak query count
 * terpisah yang masing-masing scan tabel yang sama. Records terbaru diambil
 * di query terpisah yang independen, dijalankan paralel dengan agregasi.
 *
 * Batas "hari ini" memakai kalender WIB (lib/school-time.ts), bukan UTC —
 * lihat komentar di lib/dashboard-stats.ts untuk alasan lengkapnya.
 */
export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, [
    "ADMIN",
    "OPERATOR",
    "WALI_KELAS",
    "VIEWER",
    "SUPER_ADMIN",
  ]);

  const url = new URL(req.url);
  const requestedClassId = url.searchParams.get("classId") ?? undefined;
  const effectiveClassId = await resolveClassScopeOrThrow(session, requestedClassId);

  const { start: todayStart, end: todayEnd } = getSchoolDayRangeUtc(new Date());
  const cacheKey = `attendance:today:${schoolLocalDateKey(new Date())}:${effectiveClassId ?? "all"}`;

  const result = await withCacheFallback(cacheKey, TODAY_STATS_TTL_SECONDS, async () => {
    const [stats, latestRecords] = await Promise.all([
      computeTodayAttendanceStats(effectiveClassId),
      prisma.attendance.findMany({
        where: {
          recordedAt: { gte: todayStart, lt: todayEnd },
          ...(effectiveClassId ? { student: { classId: effectiveClassId } } : {}),
        },
        orderBy: { recordedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          matchScore: true,
          recordedAt: true,
          student: {
            select: {
              fullName: true,
              nisn: true,
              class: { select: { name: true, major: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

    return { stats, records: latestRecords };
  });

  return NextResponse.json(result);
});
