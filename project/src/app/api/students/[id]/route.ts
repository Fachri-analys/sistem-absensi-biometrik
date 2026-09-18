import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, updateStudentSchema } from "@/lib/validation";
import { recordAudit, getClientIp } from "@/lib/audit";
export const dynamic = "force-dynamic";


interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/students/:id — satu query dengan include terarah (class + major +
 * wali kelas), tidak ada query tambahan per field relasi.
 */
export const GET = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  const session = await requireAuth(req, [
    "ADMIN",
    "OPERATOR",
    "WALI_KELAS",
    "VIEWER",
    "SUPER_ADMIN",
  ]);

  const student = await prisma.student.findUnique({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true,
      nisn: true,
      fullName: true,
      gender: true,
      isActive: true,
      photoObjectKey: true,
      class: {
        select: {
          id: true,
          name: true,
          major: { select: { id: true, name: true } },
          homeroomTeacher: { select: { id: true, fullName: true } },
        },
      },
    },
  });

  if (!student) throw Errors.notFound("Siswa");

  // WALI_KELAS hanya boleh lihat siswa di kelasnya (server-side enforcement).
  if (session.role === "WALI_KELAS") {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { homeroomClassId: true },
    });
    if (student.class.id !== user?.homeroomClassId) {
      throw Errors.forbidden("Anda hanya dapat mengakses data kelas yang Anda ampu.");
    }
  }

  return NextResponse.json(student);
});

/**
 * PUT /api/students/:id
 */
export const PUT = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
  const body = parseOrThrow(updateStudentSchema, await req.json().catch(() => ({})));

  const existing = await prisma.student.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true, nisn: true, fullName: true, gender: true, classId: true },
  });
  if (!existing) throw Errors.notFound("Siswa");

  if (body.nisn && body.nisn !== existing.nisn) {
    const conflict = await prisma.student.findUnique({
      where: { nisn: body.nisn },
      select: { id: true, deletedAt: true },
    });
    if (conflict && !conflict.deletedAt) {
      throw Errors.conflict("NISN sudah terdaftar untuk siswa aktif lain.");
    }
  }

  if (body.classId) {
    const classExists = await prisma.class.findUnique({
      where: { id: body.classId, deletedAt: null },
      select: { id: true },
    });
    if (!classExists) throw Errors.validation({ classId: ["Kelas tidak ditemukan."] });
  }

  const updated = await prisma.student.update({
    where: { id: params.id },
    data: {
      nisn: body.nisn,
      fullName: body.fullName,
      gender: body.gender,
      classId: body.classId,
    },
    select: { id: true, nisn: true, fullName: true, gender: true, classId: true },
  });

  await recordAudit({
    actorUserId: session.userId,
    action: "STUDENT_UPDATE",
    entityType: "Student",
    entityId: updated.id,
    before: existing,
    after: updated,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
});

/**
 * DELETE /api/students/:id — soft delete (deletedAt), bukan hard delete,
 * agar riwayat attendance historis tetap valid (docs/04-ERD.md §4).
 */
export const DELETE = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);

  const existing = await prisma.student.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true, nisn: true, fullName: true },
  });
  if (!existing) throw Errors.notFound("Siswa");

  await prisma.$transaction([
    prisma.student.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    }),
    // Nonaktifkan profil biometrik segera saat siswa dihapus (soft delete),
    // sesuai docs/06-SECURITY-SPEC.md §Data Deletion — bukan menunggu job
    // terpisah yang bisa telat/lupa dijalankan.
    prisma.biometricProfile.updateMany({
      where: { studentId: params.id },
      data: { isActive: false },
    }),
  ]);

  await recordAudit({
    actorUserId: session.userId,
    action: "STUDENT_DELETE",
    entityType: "Student",
    entityId: existing.id,
    before: existing,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
});
