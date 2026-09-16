import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { parseOrThrow, updateCameraSchema } from "@/lib/validation";
import { generateCameraApiKey, hashCameraApiKey } from "@/lib/camera-key";
import { recordAudit, getClientIp } from "@/lib/audit";

interface RouteContext {
  params: { id: string };
}

export const PUT = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
  const body = parseOrThrow(updateCameraSchema, await req.json().catch(() => ({})));

  const existing = await prisma.camera.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true, location: true, status: true },
  });
  if (!existing) throw Errors.notFound("Kamera");

  let newRawApiKey: string | undefined;
  const data: Record<string, unknown> = {
    name: body.name,
    location: body.location,
    status: body.status,
    resolution: body.resolution,
    fps: body.fps,
  };

  if (body.regenerateKey) {
    newRawApiKey = generateCameraApiKey();
    data.apiKeyHash = hashCameraApiKey(newRawApiKey);
  }

  const updated = await prisma.camera.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, location: true, status: true, resolution: true, fps: true },
  });

  await recordAudit({
    actorUserId: session.userId,
    action: "CAMERA_UPDATE",
    entityType: "Camera",
    entityId: updated.id,
    before: existing,
    after: updated,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(newRawApiKey ? { ...updated, apiKey: newRawApiKey } : updated);
});
