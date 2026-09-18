import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { resolveClassScopeOrThrow } from "@/lib/scope";
import { withCacheFallback } from "@/lib/redis";

export const dynamic = "force-dynamic";

const LATEST_CACHE_TTL_SECONDS = 5; // docs/08-CACHE-SPEC.md

export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, [
    "ADMIN",
    "OPERATOR",
    "WALI_KELAS",
    "VIEWER",
    "SUPER_ADMIN",
  ]);

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "5"), 50);
  const effectiveClassId = await resolveClassScopeOrThrow(
    session,
    url.searchParams.get("classId") ?? undefined
  );

  const cacheKey = `attendance:latest:${limit}:${effectiveClassId ?? "all"}`;

  const records = await withCacheFallback(cacheKey, LATEST_CACHE_TTL_SECONDS, () =>
    prisma.attendance.findMany({
      where: effectiveClassId ? { student: { classId: effectiveClassId } } : undefined,
      orderBy: { recordedAt: "desc" },
      take: limit,
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
        camera: { select: { name: true, location: true } },
      },
    })
  );

  return NextResponse.json({ data: records });
});
