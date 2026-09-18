import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, exportReportSchema } from "@/lib/validation";
import { resolveClassScopeOrThrow } from "@/lib/scope";
import { reportGenerationQueue } from "@/lib/queues";
import { recordAudit, getClientIp } from "@/lib/audit";
export const dynamic = "force-dynamic";


/**
 * POST /api/reports/export (FR-REPORT-001)
 *
 * Route ini HANYA membuat record `reports` berstatus PENDING dan meng-
 * enqueue job — generate PDF yang sebenarnya (bisa memakan waktu untuk
 * rentang tanggal besar) terjadi di worker (worker/processors/report-generation.ts),
 * bukan di request HTTP ini (docs/09-QUEUE-WORKER-SPEC.md: timeout worker
 * untuk report-generation 5 menit, jauh melebihi batas wajar untuk HTTP
 * request synchronous).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, ["ADMIN", "WALI_KELAS", "VIEWER", "SUPER_ADMIN"]);
  const body = parseOrThrow(exportReportSchema, await req.json().catch(() => ({})));

  // WALI_KELAS hanya boleh export laporan kelasnya sendiri — dipaksa di
  // server, konsisten dengan seluruh endpoint lain yang scoped per kelas.
  const effectiveClassId = await resolveClassScopeOrThrow(session, body.filter.classId);

  if (body.filter.classId) {
    const classExists = await prisma.class.findUnique({
      where: { id: body.filter.classId, deletedAt: null },
      select: { id: true },
    });
    if (!classExists) throw Errors.validation({ classId: ["Kelas tidak ditemukan."] });
  }

  const dateFrom = new Date(body.filter.dateFrom);
  const dateTo = new Date(body.filter.dateTo);
  if (dateFrom > dateTo) {
    throw Errors.validation({ dateFrom: ["dateFrom harus sebelum atau sama dengan dateTo."] });
  }

  const report = await prisma.report.create({
    data: {
      requestedBy: session.userId,
      type: "ATTENDANCE_EXPORT",
      filterParams: {
        classId: effectiveClassId ?? null,
        dateFrom: body.filter.dateFrom,
        dateTo: body.filter.dateTo,
      },
      status: "PENDING",
    },
    select: { id: true, status: true },
  });

  await reportGenerationQueue.add(
    "generate",
    {
      reportId: report.id,
      requestedBy: session.userId,
      type: "ATTENDANCE_EXPORT" as const,
      filterParams: {
        classId: effectiveClassId,
        dateFrom: body.filter.dateFrom,
        dateTo: body.filter.dateTo,
      },
    },
    { jobId: report.id } // idempotency: retry enqueue dengan reportId sama tidak dobel
  );

  await recordAudit({
    actorUserId: session.userId,
    action: "EXPORT_REPORT_REQUESTED",
    entityType: "Report",
    entityId: report.id,
    after: { type: "ATTENDANCE_EXPORT", filter: body.filter },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ reportId: report.id, status: report.status }, { status: 202 });
});
