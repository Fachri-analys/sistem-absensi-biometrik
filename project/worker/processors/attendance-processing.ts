import type { Job } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import { logger } from "../../src/lib/logger";

/**
 * docs/09-QUEUE-WORKER-SPEC.md — queue `attendance-processing`.
 *
 * Job ini dijalankan SETELAH attendance inti sudah tersimpan di PostgreSQL
 * oleh route POST /api/attendance (source of truth sudah aman sebelum job
 * ini bahkan mulai). Tugas worker di sini murni pekerjaan turunan:
 *   1. Memverifikasi record attendance benar-benar ada (defense in depth —
 *      tidak percaya buta pada payload job, sesuai trust boundary di
 *      docs/03-SAD.md §6).
 *   2. Placeholder untuk trigger notifikasi ke wali kelas (mis. saat siswa
 *      terlambat) — TEMPLATE dan KANAL notifikasi konkret belum
 *      diimplementasikan di tahap ini (Phase 2 pada roadmap), sehingga
 *      ditandai jujur sebagai TODO, bukan pura-pura sudah lengkap.
 *
 * IDEMPOTENCY: BullMQ jobId di-set sama dengan attendanceId (lihat
 * enqueueAttendanceProcessing di lib/queues.ts) — BullMQ sendiri menolak
 * menambahkan job baru dengan jobId yang sudah ada di queue/berjalan,
 * sehingga retry otomatis dari BullMQ tidak menghasilkan duplikat proses.
 * Selain itu, dilakukan pengecekan ekstra di sini: bila attendance sudah
 * tidak ada (mis. dihapus manual antara enqueue dan proses), job dianggap
 * selesai (bukan error) — tidak ada apa pun untuk diproses lagi.
 */

export interface AttendanceProcessingJobData {
  attendanceId: string;
  studentId: string;
  cameraId: string | null;
  recordedAt: string;
}

export async function processAttendanceJob(job: Job<AttendanceProcessingJobData>): Promise<void> {
  const { attendanceId, studentId } = job.data;
  const log = logger.child({ jobId: job.id, queue: "attendance-processing", attendanceId });

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, status: true, student: { select: { fullName: true, classId: true } } },
  });

  if (!attendance) {
    log.warn({ msg: "attendance_record_not_found_skipping" });
    return; // Selesai tanpa error — tidak ada yang bisa diproses, bukan kegagalan job.
  }

  log.info({ msg: "attendance_processed", status: attendance.status, studentId });

  // TODO(notification, Phase 2): saat status === "LATE", enqueue job ke
  // queue `notification` dengan template & kanal (WA/email) yang masih
  // menunggu keputusan produk (lihat OPEN QUESTIONS di docs). Sengaja belum
  // diimplementasikan di sini agar tidak mengarang kontrak notifikasi yang
  // belum disepakati.
}
