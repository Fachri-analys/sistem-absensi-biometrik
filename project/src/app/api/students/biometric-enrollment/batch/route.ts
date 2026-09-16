import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { recordAudit, getClientIp } from "@/lib/audit";
import { uploadObject, Buckets } from "@/lib/object-storage";
import { faceEnrollmentQueue } from "@/lib/queues";
import { Errors } from "@/lib/api-errors";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/students/biometric-enrollment/batch (FR-ENROLL-002)
 *
 * Manifest wajib dikirim sebagai field "manifest" berisi JSON:
 *   [{ "nisn": "1234567890", "filename": "foto1.jpg" }, ...]
 * dan setiap file yang disebut dalam manifest harus ada di formData dengan
 * key = filename yang sama.
 *
 * PENTING (FR-ENROLL-002): kegagalan satu file (NISN tidak ditemukan, tipe
 * file salah, dst) TIDAK BOLEH menggagalkan seluruh batch — setiap file
 * diproses independen dan dilaporkan per item.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);

  const formData = await req.formData().catch(() => null);
  if (!formData) throw Errors.validation({ body: ["multipart/form-data diperlukan."] });

  const manifestRaw = formData.get("manifest");
  if (typeof manifestRaw !== "string") {
    throw Errors.validation({ manifest: ["Field 'manifest' (JSON) wajib disertakan."] });
  }

  let manifest: Array<{ nisn: string; filename: string }>;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    throw Errors.validation({ manifest: ["Manifest harus JSON valid."] });
  }

  const batchId = randomUUID();
  const results: Array<{ nisn: string; filename: string; status: string; reason?: string }> = [];

  for (const entry of manifest) {
    try {
      const file = formData.get(entry.filename);

      if (!file || !(file instanceof File)) {
        results.push({ ...entry, status: "FAILED", reason: "File tidak ditemukan di request." });
        continue;
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        results.push({ ...entry, status: "FAILED", reason: "Tipe file harus JPEG/PNG." });
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        results.push({ ...entry, status: "FAILED", reason: "Ukuran file melebihi 5MB." });
        continue;
      }

      const student = await prisma.student.findUnique({
        where: { nisn: entry.nisn, deletedAt: null },
        select: { id: true },
      });
      if (!student) {
        results.push({ ...entry, status: "FAILED", reason: "NISN tidak ditemukan." });
        continue;
      }

      // BUG YANG DIPERBAIKI: endpoint manual (biometric-enrollment/route.ts)
      // sudah mengecek job yang sedang berjalan sebelum enqueue, tapi batch
      // endpoint ini sebelumnya TIDAK — karena jobId dibuat deterministik
      // (`enroll-${student.id}`), dua entri untuk NISN yang sama dalam satu
      // manifest (atau manual+batch bersamaan untuk siswa yang sama) bisa
      // menyebabkan `faceEnrollmentQueue.add()` kedua diam-diam tidak
      // ter-enqueue (BullMQ tidak menambah job baru dengan jobId yang masih
      // aktif) — siswa itu akan dilaporkan "QUEUED" padahal fotonya tidak
      // pernah benar-benar diproses. Dicek eksplisit di sini, dilaporkan
      // sebagai kegagalan item (bukan sukses palsu) kalau memang bentrok.
      const existingJob = await faceEnrollmentQueue.getJob(`enroll-${student.id}`);
      if (existingJob) {
        const isFinished = (await existingJob.isCompleted()) || (await existingJob.isFailed());
        if (!isFinished) {
          results.push({
            ...entry,
            status: "FAILED",
            reason: "Enrolment untuk siswa ini sudah sedang berjalan (dari request lain).",
          });
          continue;
        }
        // Hapus job lama yang sudah selesai agar BullMQ dapat mengeksekusi job baru
        await existingJob.remove().catch(() => {});
      }

      const enrollmentId = randomUUID();
      const ext = file.type === "image/png" ? "png" : "jpg";
      const tempObjectKey = `enrollment/${student.id}/${enrollmentId}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      await uploadObject(Buckets.enrollmentTemp, tempObjectKey, buffer, file.type);
      await faceEnrollmentQueue.add(
        "enroll",
        {
          enrollmentId,
          studentId: student.id,
          tempObjectKey,
          source: "BATCH_UPLOAD" as const,
        },
        { jobId: `enroll-${student.id}` }
      );

      results.push({ ...entry, status: "QUEUED" });
    } catch (err) {
      // Kegagalan tak terduga pada SATU file tidak menghentikan file lain
      // dalam loop (FR-ENROLL-002) — dicatat sebagai FAILED untuk item ini saja.
      results.push({ ...entry, status: "FAILED", reason: "Kesalahan tak terduga." });
      console.error({ msg: "batch_enrollment_item_failed", entry, error: err });
    }
  }

  await recordAudit({
    actorUserId: session.userId,
    action: "ENROLLMENT_BATCH_REQUESTED",
    entityType: "BatchEnrollment",
    entityId: batchId,
    after: { totalFiles: manifest.length, results },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(
    { batchId, totalFiles: manifest.length, status: "PROCESSING", results },
    { status: 202 }
  );
});
