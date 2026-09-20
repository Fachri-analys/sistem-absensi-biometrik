import { redis } from "./redis";
import type Redis from "ioredis";

/**
 * docs/02-SRS.md FR-SYNC-REALTIME-001: event kehadiran baru harus sampai ke
 * dashboard dalam ≤2 detik. Redis Pub/Sub dipilih sebagai transport perantara
 * karena APP bersifat stateless multi-instance (docs/03-SAD.md) — instance
 * APP mana pun yang menulis attendance belum tentu instance yang sama dengan
 * koneksi WebSocket klien tertentu, jadi publish harus lewat broker bersama,
 * bukan in-memory event emitter per proses.
 *
 * Bridge WebSocket/SSE yang men-subscribe channel ini adalah bagian dari
 * PHASE 9 (Realtime Attendance) — belum diimplementasikan di tahap ini.
 * Fungsi publish sudah disiapkan sekarang supaya route attendance tidak
 * perlu diubah lagi saat bridge realtime dibangun.
 */

export const REALTIME_ATTENDANCE_CHANNEL = "realtime:attendance";

export interface AttendanceRealtimeEvent {
  attendanceId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  // null = presensi via HP pribadi siswa (channel STUDENT_PHONE).
  cameraId: string | null;
  status: "ON_TIME" | "LATE";
  matchScore: number;
  recordedAt: string;
}

export async function publishAttendanceEvent(event: AttendanceRealtimeEvent): Promise<void> {
  try {
    await redis.publish(REALTIME_ATTENDANCE_CHANNEL, JSON.stringify(event));
  } catch (err) {
    // Kegagalan publish realtime TIDAK BOLEH menggagalkan pencatatan
    // attendance itu sendiri — dashboard fallback ke polling REST
    // (NFR-AVAIL-001) jika event ini hilang.
    console.warn({ msg: "publish_attendance_event_failed", error: err });
  }
}

/**
 * ioredis TIDAK BOLEH menjalankan perintah lain di koneksi yang sedang
 * dalam mode SUBSCRIBE. Karena itu setiap konsumen SSE/WebSocket butuh
 * koneksi duplikat sendiri (bukan memakai `redis` yang dipakai bersama
 * untuk cache/rate-limit) — satu koneksi per klien yang terhubung.
 */
export function createAttendanceSubscriber(): Redis {
  return redis.duplicate();
}
