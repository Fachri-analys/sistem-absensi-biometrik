import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, updateClassSchema } from "@/lib/validation";
import { recordAudit, getClientIp } from "@/lib/audit";
import { invalidateCache } from "@/lib/redis";

interface RouteContext {
  params: { id: string };
}

export const PUT = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
  const body = parseOrThrow(updateClassSchema, await req.json().catch(() => ({})));

  const existing = await prisma.class.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true, majorId: true, homeroomTeacherId: true },
  });
  if (!existing) throw Errors.notFound("Kelas");

  if (body.majorId) {
    const major = await prisma.major.findUnique({
      where: { id: body.majorId, deletedAt: null },
      select: { id: true },
    });
    if (!major) throw Errors.validation({ majorId: ["Jurusan tidak ditemukan."] });
  }

  if (body.homeroomTeacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: body.homeroomTeacherId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) throw Errors.validation({ homeroomTeacherId: ["Guru tidak ditemukan."] });
  }

  const updated = await prisma.class.update({
    where: { id: params.id },
    data: {
      name: body.name,
      majorId: body.majorId,
      homeroomTeacherId: body.homeroomTeacherId,
    },
    select: { id: true, name: true, majorId: true, homeroomTeacherId: true },
  });

  await invalidateCache("classes:list");

  await recordAudit({
    actorUserId: session.userId,
    action: "CLASS_UPDATE",
    entityType: "Class",
    entityId: updated.id,
    before: existing,
    after: updated,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
});
