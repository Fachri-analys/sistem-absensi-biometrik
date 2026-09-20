import { Queue } from "bullmq";

/**
 * docs/09-QUEUE-WORKER-SPEC.md
 *
 * File ini HANYA berisi producer (enqueue). Consumer/worker berjalan sebagai
 * proses terpisah (lihat worker/index.ts) — dipisah secara fisik dari APP
 * agar keduanya bisa di-scale independen (docs/03-SAD.md §5 Scaling Strategy).
 *
 * PENTING: enqueue TIDAK BOLEH blocking response HTTP ke kamera/klien.
 * Semua pemanggil di route handler harus fire-and-forget dengan try/catch —
 * kegagalan enqueue dicatat sebagai warning, bukan menggagalkan request yang
 * sudah berhasil menulis data inti ke PostgreSQL (source of truth tetap aman
 * meski job turunan gagal dikirim).
 */

// BullMQ butuh koneksi ioredis dengan maxRetriesPerRequest: null.
// Dibuat terpisah dari client `redis` umum agar konfigurasi retry tidak
// saling mengganggu antara pemakaian cache/rate-limit dan queue.
import Redis from "ioredis";
import { env } from "./env";

// env.REDIS_URL sudah divalidasi (wajib ada, tidak boleh kosong) oleh
// src/lib/env.ts saat modul ini pertama di-import — sebelumnya baris ini
// memakai `process.env.REDIS_URL ?? ""`, yang berarti jika env var hilang,
// ioredis akan mencoba connect ke connection string KOSONG alih-alih gagal
// dengan pesan jelas saat start. Itu bug nyata: kegagalan baru muncul nanti
// dengan pesan error yang membingungkan, jauh dari akar masalahnya.
const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const attendanceProcessingQueue = new Queue("attendance-processing", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const notificationQueue = new Queue("notification", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const reportGenerationQueue = new Queue("report-generation", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
  },
});

export const faceEnrollmentQueue = new Queue("face-enrollment", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 1, // kegagalan validasi kualitas foto tidak di-retry otomatis (lihat docs)
    removeOnComplete: 500,
    removeOnFail: 2000,
  },
});

interface AttendanceProcessingPayload {
  attendanceId: string;
  studentId: string;
  // null = presensi via HP pribadi siswa (channel STUDENT_PHONE), tidak ada
  // device kamera yang terlibat.
  cameraId: string | null;
  recordedAt: string;
}

/**
 * Enqueue job turunan setelah attendance inti tersimpan. Non-blocking:
 * kegagalan di sini tidak boleh membuat POST /api/attendance mengembalikan
 * error ke kamera, karena data attendance-nya sendiri sudah aman tersimpan.
 */
export async function enqueueAttendanceProcessing(
  payload: AttendanceProcessingPayload
): Promise<void> {
  try {
    await attendanceProcessingQueue.add("process", payload, {
      jobId: payload.attendanceId, // idempotency berbasis attendanceId
    });
  } catch (err) {
    console.warn({ msg: "enqueue_attendance_processing_failed", payload, error: err });
  }
}
