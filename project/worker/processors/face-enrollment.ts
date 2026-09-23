import type { Job } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import { logger } from "../../src/lib/logger";
import { deleteObject, getObject, Buckets } from "../../src/lib/object-storage";
import { getFaceRecognitionEngine } from "../../src/lib/face-recognition";
import { recordAudit } from "../../src/lib/audit";

/**
 * docs/09-QUEUE-WORKER-SPEC.md — queue `face-enrollment`.
 * FR-ENROLL-003..006, NFR-SEC-004 (docs/02-SRS.md), docs/06-SECURITY-SPEC.md.
 *
 * ATURAN PALING PENTING DI FILE INI: `tempObjectKey` WAJIB dihapus permanen
 * di akhir proses — BAIK job berhasil MAUPUN gagal. Blok finally memastikan
 * penghapusan selalu dicoba terlepas dari hasil validasi/embedding di atas.
 * Struktur kode sengaja TIDAK memakai `return` di tengah try — semua jalur
 * (sukses, siswa tidak ditemukan, kualitas foto gagal) mengalir ke variabel
 * `outcome`/`failureReason`, baru diputuskan setelah finally selesai,
 * supaya penghapusan foto dan pelemparan error final tidak pernah saling
 * melewatkan satu sama lain.
 */

export interface FaceEnrollmentJobData {
  enrollmentId: string;
  studentId: string;
  tempObjectKey: string;
  tempObjectKeys?: string[];
  source: "MANUAL_UPLOAD" | "BATCH_UPLOAD";
}

export async function processFaceEnrollmentJob(job: Job<FaceEnrollmentJobData>): Promise<void> {
  const { enrollmentId, studentId, tempObjectKey, source } = job.data;
  const log = logger.child({ jobId: job.id, queue: "face-enrollment", studentId, enrollmentId });

  let outcome: "SUCCESS" | "FAILED" = "FAILED";
  let failureReason: string | undefined;

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      failureReason = "Siswa tidak ditemukan (mungkin dihapus setelah enrolment diajukan).";
      log.warn({ msg: "enrollment_student_not_found" });
    } else {
      // BUG YANG DIPERBAIKI: versi sebelumnya memakai buffer placeholder
      // (`Buffer.alloc(50*1024)`) alih-alih benar-benar membaca foto yang
      // diupload — artinya validasi kualitas foto TIDAK PERNAH memeriksa
      // konten asli, dan embedding yang dihasilkan bukan berasal dari foto
      // siswa sungguhan sama sekali. Sekarang foto benar-benar diambil dari
      // Object Storage sebelum diproses.
      const engine = getFaceRecognitionEngine();
      const allKeys = job.data.tempObjectKeys ?? [tempObjectKey];
      const photoBuffers: Buffer[] = [];

      for (const key of allKeys) {
        const buf = await getObject(Buckets.enrollmentTemp, key);
        photoBuffers.push(buf);
      }

      // Validate quality for each photo
      for (const [i, photoBuf] of photoBuffers.entries()) {
        const quality = await engine.validatePhotoQuality(photoBuf);
        if (!quality.isValid) {
          failureReason = `Kualitas foto sampel ${i + 1} tidak memenuhi syarat: ${quality.reason}`;
          log.warn({ msg: "enrollment_quality_check_failed", reason: quality.reason, photoIndex: i });
          break;
        }
      }

      if (!failureReason) {
        let embedding;
        if (photoBuffers.length > 1) {
          embedding = await engine.generateMultiSampleEmbedding(photoBuffers);
        } else {
          embedding = await engine.generateEmbedding(photoBuffers[0]!);
        }

        await prisma.biometricProfile.upsert({
          where: { studentId },
          create: {
            studentId,
            embeddingRef: embedding.embeddingRef,
            embeddingVersion: embedding.embeddingVersion,
            sourceType: source,
            isActive: true,
          },
          update: {
            embeddingRef: embedding.embeddingRef,
            embeddingVersion: embedding.embeddingVersion,
            sourceType: source,
            isActive: true,
            enrolledAt: new Date(),
          },
        });

        outcome = "SUCCESS";
        log.info({ msg: "enrollment_success", sampleCount: photoBuffers.length });
      }
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : "Kesalahan tak terduga saat enrolment.";
    log.error({ msg: "enrollment_unexpected_error", error: err });
  } finally {
    // WAJIB dijalankan terlepas dari hasil di atas.
    const allKeysToDelete = job.data.tempObjectKeys ?? [job.data.tempObjectKey];
    for (const key of allKeysToDelete) {
      try {
        await deleteObject(Buckets.enrollmentTemp, key);
        log.info({ msg: "enrollment_temp_photo_deleted", tempObjectKey: key });
      } catch (deleteErr) {
        log.error({ msg: "enrollment_temp_photo_delete_failed", tempObjectKey: key, error: deleteErr });
        await recordAudit({
          actorUserId: null,
          action: "ENROLLMENT_PHOTO_DELETE_FAILED",
          entityType: "Student",
          entityId: studentId,
          after: { enrollmentId, tempObjectKey: key },
        });
        // Dilempar ulang supaya job ditandai gagal dan memicu alert — foto
        // yang gagal dihapus adalah pelanggaran kebijakan keamanan
        // (docs/06-SECURITY-SPEC.md), bukan kondisi yang boleh dilewati diam-diam.
        throw deleteErr;
      }
    }

    await recordAudit({
      actorUserId: null, // job sistem, bukan aksi user langsung
      action: outcome === "SUCCESS" ? "ENROLLMENT_SUCCESS" : "ENROLLMENT_FAILED",
      entityType: "Student",
      entityId: studentId,
      after: { enrollmentId, source, failureReason },
    });
  }

  if (outcome === "FAILED") {
    // Dilempar SETELAH foto dipastikan terhapus di blok finally, supaya
    // BullMQ mencatat job ini sebagai failed dengan alasan yang jelas tanpa
    // mengorbankan jaminan penghapusan foto.
    throw new Error(failureReason ?? "Enrolment gagal tanpa alasan spesifik.");
  }
}
