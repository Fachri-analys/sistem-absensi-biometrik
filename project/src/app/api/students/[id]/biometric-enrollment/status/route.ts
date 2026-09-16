import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { faceEnrollmentQueue } from "@/lib/queues";

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/students/:id/biometric-enrollment/status
 * TIDAK PERNAH mengembalikan foto atau embedding — hanya status ringkas.
 */
export const GET = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);

  const student = await prisma.student.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true },
  });
  if (!student) throw Errors.notFound("Siswa");

  const job = await faceEnrollmentQueue.getJob(`enroll-${params.id}`);
  const profile = await prisma.biometricProfile.findUnique({
    where: { studentId: params.id },
    select: { isActive: true, enrolledAt: true, sourceType: true },
  });

  if (job && !(await job.isCompleted()) && !(await job.isFailed())) {
    return NextResponse.json({ status: "PROCESSING" });
  }

  if (profile?.isActive) {
    return NextResponse.json({
      status: "SUCCESS",
      enrolledAt: profile.enrolledAt,
      source: profile.sourceType,
    });
  }

  if (job && (await job.isFailed())) {
    return NextResponse.json({
      status: "FAILED",
      lastFailureReason: job.failedReason ?? "Tidak diketahui",
    });
  }

  return NextResponse.json({ status: "NOT_ENROLLED" });
});
