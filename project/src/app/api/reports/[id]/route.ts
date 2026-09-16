import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { getPresignedDownloadUrl, Buckets } from "@/lib/object-storage";

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/reports/:id (OQ-API-01 di docs/05-API-SPEC.md — endpoint polling
 * yang belum resmi terdaftar di spec awal, ditambahkan sebagai kebutuhan
 * turunan wajar agar klien tahu kapan file siap diunduh).
 */
export const GET = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  const session = await requireAuth(req, ["ADMIN", "WALI_KELAS", "VIEWER", "SUPER_ADMIN"]);

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      requestedBy: true,
      status: true,
      objectKey: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  if (!report) throw Errors.notFound("Laporan");

  // Hanya pemilik request atau ADMIN/SUPER_ADMIN yang boleh melihat status
  // dan mengunduh — laporan bisa memuat data siswa lintas kelas.
  const isOwner = report.requestedBy === session.userId;
  const isElevated = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  if (!isOwner && !isElevated) {
    throw Errors.forbidden("Anda tidak memiliki akses ke laporan ini.");
  }

  if (report.status !== "DONE" || !report.objectKey) {
    return NextResponse.json({ reportId: report.id, status: report.status });
  }

  const downloadUrl = await getPresignedDownloadUrl(Buckets.reports, report.objectKey, 3600);

  return NextResponse.json({
    reportId: report.id,
    status: report.status,
    downloadUrl,
    expiresAt: report.expiresAt,
  });
});
