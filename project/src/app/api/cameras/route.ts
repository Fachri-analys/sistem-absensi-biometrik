import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, createCameraSchema } from "@/lib/validation";
import { generateCameraApiKey, hashCameraApiKey } from "@/lib/camera-key";
import { recordAudit, getClientIp } from "@/lib/audit";
export const dynamic = "force-dynamic";


export const GET = withErrorHandling(async (req: Request) => {
  await requireAuth(req, ["ADMIN", "OPERATOR", "SUPER_ADMIN"]);

  const cameras = await prisma.camera.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      lastSeenAt: true,
      resolution: true,
      fps: true,
      // apiKeyHash SENGAJA tidak pernah di-select untuk endpoint list/detail.
    },
  });

  return NextResponse.json({ data: cameras });
});

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
  const body = parseOrThrow(createCameraSchema, await req.json().catch(() => ({})));

  const rawApiKey = generateCameraApiKey();
  const apiKeyHash = hashCameraApiKey(rawApiKey);

  const camera = await prisma.camera.create({
    data: {
      name: body.name,
      location: body.location,
      apiKeyHash,
      status: "OFFLINE",
    },
    select: { id: true, name: true, location: true, status: true },
  });

  await recordAudit({
    actorUserId: session.userId,
    action: "CAMERA_CREATE",
    entityType: "Camera",
    entityId: camera.id,
    after: camera,
    ipAddress: getClientIp(req),
  });

  // apiKey mentah HANYA ditampilkan sekali di sini, tidak pernah bisa
  // diambil ulang setelah ini — sesuai docs/05-API-SPEC.md (POST /api/cameras).
  return NextResponse.json({ ...camera, apiKey: rawApiKey }, { status: 201 });
});
