import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, studentListQuerySchema, createStudentSchema } from "@/lib/validation";
import { paginate } from "@/lib/scope";
import { resolveClassScopeOrThrow } from "@/lib/scope";
import { recordAudit, getClientIp } from "@/lib/audit";

/**
 * GET /api/students (FR-STUDENT-001, FR-STUDENT-003, FR-STUDENT-004)
 *
 * ANTI N+1: relasi `class` dan `class.major` diambil dalam SATU query lewat
 * `include`, bukan di-fetch satu per satu per baris siswa di loop terpisah.
 * findMany dan count dijalankan paralel (lihat paginate() di lib/scope.ts).
 * Field biometrik TIDAK PERNAH disertakan (tidak ada relasi biometricProfile
 * di select/include ini sama sekali).
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
  const query = parseOrThrow(studentListQuerySchema, Object.fromEntries(url.searchParams));

  // WALI_KELAS dipaksa hanya melihat kelasnya sendiri — server-side, bukan
  // hanya filter opsional dari client (docs/05-API-SPEC.md, Authorization).
  const effectiveClassId = await resolveClassScopeOrThrow(session, query.classId);

  const where: Prisma.StudentWhereInput = {
    deletedAt: null,
    ...(effectiveClassId ? { classId: effectiveClassId } : {}),
    ...(query.majorId ? { class: { majorId: query.majorId } } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: "insensitive" } },
            { nisn: { contains: query.search } },
          ],
        }
      : {}),
  };

  const result = await paginate({ page: query.page, pageSize: query.pageSize }, ({ skip, take }) => ({
    findMany: prisma.student.findMany({
      where,
      skip,
      take,
      orderBy: { fullName: "asc" },
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
          },
        },
      },
    }),
    count: prisma.student.count({ where }),
  }));

  return NextResponse.json(result);
});

/**
 * POST /api/students (FR-STUDENT-001, FR-STUDENT-002)
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
  const body = parseOrThrow(createStudentSchema, await req.json().catch(() => ({})));

  const classExists = await prisma.class.findUnique({
    where: { id: body.classId, deletedAt: null },
    select: { id: true },
  });
  if (!classExists) {
    throw Errors.validation({ classId: ["Kelas tidak ditemukan."] });
  }

  const existingNisn = await prisma.student.findUnique({
    where: { nisn: body.nisn },
    select: { id: true, deletedAt: true },
  });
  if (existingNisn && !existingNisn.deletedAt) {
    throw Errors.conflict("NISN sudah terdaftar untuk siswa aktif lain.");
  }

  const student = await prisma.student.create({
    data: {
      nisn: body.nisn,
      fullName: body.fullName,
      classId: body.classId,
      gender: body.gender,
    },
    select: {
      id: true,
      nisn: true,
      fullName: true,
      gender: true,
      isActive: true,
      classId: true,
    },
  });

  await recordAudit({
    actorUserId: session.userId,
    action: "STUDENT_CREATE",
    entityType: "Student",
    entityId: student.id,
    after: student,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(student, { status: 201 });
});
