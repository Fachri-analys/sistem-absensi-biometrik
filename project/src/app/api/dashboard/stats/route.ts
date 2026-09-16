import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { resolveClassScopeOrThrow } from "@/lib/scope";
import { withCacheFallback } from "@/lib/redis";
import { computeTodayAttendanceStats, dashboardCacheKey } from "@/lib/dashboard-stats";

const STATS_TTL_SECONDS = 30; // docs/08-CACHE-SPEC.md

/**
 * GET /api/dashboard/stats (FR-DASH-001)
 * Sengaja memakai fungsi agregasi yang SAMA dengan /api/attendance/today
 * (computeTodayAttendanceStats) — bukan menyalin ulang query groupBy di sini.
 * Kalau logic-nya perlu berubah nanti, cukup diubah di satu tempat.
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
  const effectiveClassId = await resolveClassScopeOrThrow(
    session,
    url.searchParams.get("classId") ?? undefined
  );

  const stats = await withCacheFallback(
    dashboardCacheKey(effectiveClassId),
    STATS_TTL_SECONDS,
    () => computeTodayAttendanceStats(effectiveClassId)
  );

  return NextResponse.json({ stats });
});
