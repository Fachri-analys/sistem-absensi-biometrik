import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, createMajorSchema } from "@/lib/validation";
import { recordAudit, getClientIp } from "@/lib/audit";

export const GET = withErrorHandling(async (req: Request) => {
  await requireAuth(req, ["ADMIN", "OPERATOR", "WALI_KELAS", "VIEWER", "SUPER_ADMIN"]);

  const majors = await prisma.major.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return NextResponse.json({ data: majors });
});

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
  const body = parseOrThrow(createMajorSchema, await req.json().catch(() => ({})));

  const existingCode = await prisma.major.findUnique({
    where: { code: body.code },
    select: { id: true, deletedAt: true },
  });
  if (existingCode && !existingCode.deletedAt) {
    throw Errors.conflict("Kode jurusan sudah digunakan.");
  }

  const major = await prisma.major.create({
    data: { name: body.name, code: body.code },
    select: { id: true, name: true, code: true },
  });

  await recordAudit({
    actorUserId: session.userId,
    action: "MAJOR_CREATE",
    entityType: "Major",
    entityId: major.id,
    after: major,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(major, { status: 201 });
});
