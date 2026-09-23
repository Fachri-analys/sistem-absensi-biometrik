import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { recordAudit, getClientIp } from "@/lib/audit";
import { uploadObject, Buckets } from "@/lib/object-storage";
import { faceEnrollmentQueue } from "@/lib/queues";

interface RouteContext {
  params: { id: string };
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, docs/15-INFRASTRUCTURE-SPEC.md

/**
 * POST /api/students/:id/biometric-enrollment (FR-ENROLL-001, FR-ENROLL-003)
 *
 * Route ini HANYA menerima & menyimpan foto ke bucket sementara, lalu
 * mengembalikan 202 — pemrosesan berat (validasi kualitas, generate
 * embedding, DAN penghapusan foto) terjadi ASINKRON di worker
 * (worker/processors/face-enrollment.ts), bukan di request HTTP ini
 * (docs/09-QUEUE-WORKER-SPEC.md: "pekerjaan berat tidak boleh blocking").
 */
export const POST = withErrorHandling(async (req: Request, { params }: RouteContext) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);

  const student = await prisma.student.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!student) throw Errors.notFound("Siswa");

  // Cegah dua enrolment berjalan bersamaan untuk siswa yang sama.
  const alreadyRunning = await faceEnrollmentQueue.getJob(`enroll-${student.id}`);
  if (alreadyRunning) {
    const isFinished = (await alreadyRunning.isCompleted()) || (await alreadyRunning.isFailed());
    if (!isFinished) {
      throw Errors.conflict("Enrolment untuk siswa ini sedang berjalan.");
    }
    // Hapus job lama yang sudah selesai (completed/failed) agar BullMQ
    // dapat mengeksekusi job baru dengan jobId deterministik yang sama.
    await alreadyRunning.remove().catch(() => {});
  }

  const formData = await req.formData().catch(() => null);
  const photo = formData?.get("photo");

  if (!photo || !(photo instanceof File)) {
    throw Errors.validation({ photo: ["File foto (field 'photo') wajib diunggah."] });
  }
  if (!ALLOWED_MIME_TYPES.has(photo.type)) {
    throw Errors.validation({ photo: ["Tipe file harus JPEG atau PNG."] });
  }
  if (photo.size > MAX_FILE_SIZE_BYTES) {
    throw Errors.validation({ photo: ["Ukuran file maksimum 5MB."] });
  }

  const enrollmentId = randomUUID();
  const tempObjectKey = `enrollment/${student.id}/${enrollmentId}.${extensionFor(photo.type)}`;
  const buffer = Buffer.from(await photo.arrayBuffer());

  // Support multi-sample: collect additional photos from 'photos' field
  const additionalPhotos: File[] = [];
  if (formData) {
    const photosField = formData.getAll("photos");
    for (const p of photosField) {
      if (p instanceof File && ALLOWED_MIME_TYPES.has(p.type) && p.size <= MAX_FILE_SIZE_BYTES) {
        additionalPhotos.push(p);
      }
    }
  }

  const allBuffers: Buffer[] = [buffer];
  const allTempKeys: string[] = [tempObjectKey];

  for (const extra of additionalPhotos.slice(0, 4)) {
    const extraId = randomUUID();
    const extraKey = `enrollment/${student.id}/${extraId}.${extensionFor(extra.type)}`;
    const extraBuf = Buffer.from(await extra.arrayBuffer());
    allBuffers.push(extraBuf);
    allTempKeys.push(extraKey);
  }

  // Upload ALL photos to temp bucket
  for (const [i, buf] of allBuffers.entries()) {
    await uploadObject(Buckets.enrollmentTemp, allTempKeys[i]!, buf, "image/jpeg");
  }

  await faceEnrollmentQueue.add(
    "enroll",
    {
      enrollmentId,
      studentId: student.id,
      tempObjectKey: allTempKeys[0],
      tempObjectKeys: allTempKeys,
      source: "MANUAL_UPLOAD" as const,
    },
    { jobId: `enroll-${student.id}` }
  );

  await recordAudit({
    actorUserId: session.userId,
    action: "ENROLLMENT_REQUESTED",
    entityType: "Student",
    entityId: student.id,
    after: { enrollmentId, source: "MANUAL_UPLOAD" },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ enrollmentId, status: "PROCESSING" }, { status: 202 });
});

function extensionFor(mimeType: string): string {
  return mimeType === "image/png" ? "png" : "jpg";
}
