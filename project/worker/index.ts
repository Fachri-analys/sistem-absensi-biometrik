import { Worker, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { logger } from "../src/lib/logger";
import { env } from "../src/lib/env";
import { processAttendanceJob } from "./processors/attendance-processing";
import { processFaceEnrollmentJob } from "./processors/face-enrollment";
import { processReportGenerationJob } from "./processors/report-generation";

/**
 * docs/03-SAD.md §5 Scaling Strategy: Worker berjalan sebagai proses
 * terpisah dari APP (`npm run worker`), sehingga bisa di-scale independen
 * (WORKER-1, WORKER-2, ... — docs/15-INFRASTRUCTURE-SPEC.md §3).
 *
 * Untuk topologi on-prem mini PC (docs/11-DEPLOYMENT.md §6-9), proses ini
 * berjalan sebagai container terpisah dalam docker-compose.yml yang sama,
 * bukan di-inline ke proses Next.js — supaya restart/scaling salah satu
 * (APP vs Worker) tidak saling mengganggu, dan graceful shutdown saat
 * relokasi fisik (docs/11-DEPLOYMENT.md §8 langkah 3) bisa dilakukan
 * berurutan: APP dulu, baru Worker.
 */

// env.REDIS_URL sudah divalidasi (wajib ada) oleh src/lib/env.ts saat modul
// ini pertama di-import — proses worker gagal start dengan pesan jelas kalau
// env var ini hilang, bukan mencoba connect ke connection string kosong.
const connection: ConnectionOptions = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const CONCURRENCY_ATTENDANCE_PROCESSING = 10; // docs/09-QUEUE-WORKER-SPEC.md
const CONCURRENCY_FACE_ENROLLMENT = 2; // I/O & CPU intensif — lihat docs/09-QUEUE-WORKER-SPEC.md
const CONCURRENCY_REPORT_GENERATION = 2; // I/O & CPU intensif — lihat docs/09-QUEUE-WORKER-SPEC.md

const attendanceWorker = new Worker("attendance-processing", processAttendanceJob, {
  connection,
  concurrency: CONCURRENCY_ATTENDANCE_PROCESSING,
});

const enrollmentWorker = new Worker("face-enrollment", processFaceEnrollmentJob, {
  connection,
  concurrency: CONCURRENCY_FACE_ENROLLMENT,
});

const reportWorker = new Worker("report-generation", processReportGenerationJob, {
  connection,
  concurrency: CONCURRENCY_REPORT_GENERATION,
});

attendanceWorker.on("completed", (job) => {
  logger.info({ msg: "job_completed", queue: "attendance-processing", jobId: job.id });
});

attendanceWorker.on("failed", (job, err) => {
  logger.error({
    msg: "job_failed",
    queue: "attendance-processing",
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    error: err.message,
  });
  // Setelah semua retry (attempts) habis, BullMQ otomatis memindahkan job
  // ke status "failed" (setara dead-letter) — dapat dipantau via
  // Worker.getFailedCount() / BullMQ dashboard eksternal (docs/12-OPERATIONS.md
  // §Alerting: "Dead-letter queue bertambah").
});

enrollmentWorker.on("completed", (job) => {
  logger.info({ msg: "job_completed", queue: "face-enrollment", jobId: job.id });
});

enrollmentWorker.on("failed", (job, err) => {
  logger.error({
    msg: "job_failed",
    queue: "face-enrollment",
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    error: err.message,
  });
  // Kegagalan enrolment berulang adalah sinyal operasional penting
  // (docs/09-QUEUE-WORKER-SPEC.md §face-enrollment: "alert khusus").
});

reportWorker.on("completed", (job) => {
  logger.info({ msg: "job_completed", queue: "report-generation", jobId: job.id });
});

reportWorker.on("failed", (job, err) => {
  logger.error({
    msg: "job_failed",
    queue: "report-generation",
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    error: err.message,
  });
});

logger.info({
  msg: "worker_started",
  queues: ["attendance-processing", "face-enrollment", "report-generation"],
});

/**
 * Graceful shutdown — penting khusus untuk topologi mini PC yang bisa
 * dimatikan sewaktu-waktu untuk relokasi fisik (docs/11-DEPLOYMENT.md §8
 * langkah 3): job yang sedang berjalan diberi kesempatan selesai dulu,
 * bukan dipotong paksa di tengah proses (yang bisa meninggalkan state
 * tidak konsisten).
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ msg: "worker_shutdown_initiated", signal });
  try {
    await Promise.all([
      attendanceWorker.close(),
      enrollmentWorker.close(),
      reportWorker.close(),
    ]);
    logger.info({ msg: "worker_shutdown_complete" });
    process.exit(0);
  } catch (err) {
    logger.error({ msg: "worker_shutdown_failed", error: err });
    process.exit(1);
  }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
