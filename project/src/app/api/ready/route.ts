import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

/**
 * GET /api/ready — readiness check (docs/05-API-SPEC.md, docs/12-OPERATIONS.md §3).
 * Load Balancer memakai ini untuk memutuskan apakah instance APP boleh
 * menerima trafik. Mengecek PostgreSQL (wajib sehat), Redis, dan Face Service.
 */
export async function GET(): Promise<NextResponse> {
  const checks: Record<string, "ok" | "degraded" | "down"> = {
    postgres: "down",
    redis: "down",
    face_service: "down",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = "ok";
  } catch {
    checks.postgres = "down";
  }

  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "degraded";
  }

  try {
    const res = await fetch(`${env.FACE_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    checks.face_service = res.ok ? "ok" : "down";
  } catch {
    checks.face_service = "down";
  }

  // PostgreSQL adalah source of truth — kalau ini down, APP benar-benar
  // tidak siap melayani trafik.
  const isReady = checks.postgres === "ok";

  return NextResponse.json(
    { status: isReady ? "ready" : "not_ready", checks },
    { status: isReady ? 200 : 503 }
  );
}
