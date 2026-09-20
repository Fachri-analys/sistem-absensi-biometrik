import { redis } from "./redis";
import { Errors } from "./api-errors";

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window rate limiter berbasis Redis INCR + EXPIRE.
 * Dipilih dibanding token bucket penuh karena cukup untuk kebutuhan
 * dokumen (docs/06-SECURITY-SPEC.md §Rate Limiting) dan jauh lebih sederhana
 * untuk diverifikasi benar (satu INCR + satu EXPIRE, atomik per key).
 *
 * PENTING (NFR-AVAIL-001): jika Redis down, rate limiting TIDAK BOLEH
 * menjatuhkan endpoint inti — fallback ke "izinkan" (fail-open) untuk
 * endpoint attendance yang kritikal, karena risiko kehilangan data presensi
 * lebih besar daripada risiko sementara tanpa rate limit saat insiden Redis.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  let current: number;
  try {
    current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
  } catch {
    // Redis unavailable — fail-open, jangan blokir request karena masalah
    // infrastruktur pendukung (bukan source of truth).
    return;
  }

  if (current > limit) {
    throw Errors.tooManyRequests();
  }
}

export const RateLimitPresets = {
  loginPerIpEmail: (ip: string, email: string) => ({
    key: `ratelimit:login:${ip}:${email}`,
    limit: 5,
    windowSeconds: 15 * 60,
  }),
  apiPerUser: (userId: string) => ({
    key: `ratelimit:api:${userId}`,
    limit: 60,
    windowSeconds: 60,
  }),
  cameraPerDevice: (cameraId: string) => ({
    key: `ratelimit:camera:${cameraId}`,
    limit: 300,
    windowSeconds: 60,
  }),
  /**
   * Endpoint check-in presensi (src/app/api/attendance/checkin/route.ts)
   * TIDAK memakai password — siswa cukup mengetik NISN, wajah yang jadi
   * bukti utama. Karena tidak ada secret yang perlu dibobol (NISN pada
   * dasarnya semi-publik di lingkungan sekolah), rate limit di sini bukan
   * mencegah "tebak password", tapi mencegah: (a) spam mencoba banyak NISN
   * dari satu perangkat/IP, dan (b) percobaan berulang dengan foto yang
   * sama berharap liveness/similarity kebetulan lolos. Dua limit terpisah
   * (per NISN dan per IP) dipakai bersamaan — keduanya harus dicek.
   */
  checkinPerNisnAndIp: (nisn: string, ip: string): [RateLimitConfig, RateLimitConfig] => [
    { key: `ratelimit:checkin:nisn:${nisn}`, limit: 10, windowSeconds: 10 * 60 },
    { key: `ratelimit:checkin:ip:${ip}`, limit: 30, windowSeconds: 10 * 60 },
  ],
};
