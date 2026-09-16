import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, createClassSchema } from "@/lib/validation";
import { recordAudit, getClientIp } from "@/lib/audit";
import { withCacheFallback, invalidateCache } from "@/lib/redis";

const CLASSES_LIST_CACHE_KEY = "classes:list";
const CLASSES_LIST_TTL_SECONDS = 600; // 10 menit (docs/08-CACHE-SPEC.md)

/**
 * GET /api/classes — di-cache karena data ini jarang berubah dan sering
 * dibaca (dipakai untuk dropdown filter di banyak halaman). Satu query saja
 * (include major + homeroomTeacher), bukan N+1 per kelas.
 */
export const GET = withErrorHandling(async (req: Request) => {
  await requireAuth(req, ["ADMIN", "OPERATOR", "WALI_KELAS", "VIEWER", "SUPER_ADMIN"]);

  const classes = await withCacheFallback(CLASSES_LIST_CACHE_KEY, CLASSES_LIST_TTL_SECONDS, () =>
    prisma.class.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        major: { select: { id: true, name: true, code: true } },
        homeroomTeacher: { select: { id: true, fullName: true } },
      },
    })
  );

  return NextResponse.json({ data: classes });
});

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
  const body = parseOrThrow(createClassSchema, await req.json().catch(() => ({})));

  const major = await prisma.major.findUnique({
    where: { id: body.majorId, deletedAt: null },
    select: { id: true },
  });
  if (!major) throw Errors.validation({ majorId: ["Jurusan tidak ditemukan."] });

  if (body.homeroomTeacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: body.homeroomTeacherId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw Errors.validation({ homeroomTeacherId: ["Guru tidak ditemukan."] });
    }
  }

  const newClass = await prisma.class.create({
    data: {
      name: body.name,
      majorId: body.majorId,
      homeroomTeacherId: body.homeroomTeacherId,
    },
    select: { id: true, name: true, majorId: true, homeroomTeacherId: true },
  });

  await invalidateCache(CLASSES_LIST_CACHE_KEY);

  await recordAudit({
    actorUserId: session.userId,
    action: "CLASS_CREATE",
    entityType: "Class",
    entityId: newClass.id,
    after: newClass,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(newClass, { status: 201 });
});
