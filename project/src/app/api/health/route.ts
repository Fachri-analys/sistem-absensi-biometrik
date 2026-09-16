import { NextResponse } from "next/server";

/**
 * GET /api/health — liveness check (docs/05-API-SPEC.md, docs/12-OPERATIONS.md §3).
 * Sengaja TIDAK mengecek dependency eksternal (DB/Redis) — itu tugas /api/ready.
 * Endpoint ini hanya menjawab "proses masih hidup", dipakai container
 * orchestrator untuk restart decision, bukan untuk routing trafik Load Balancer.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok" });
}
