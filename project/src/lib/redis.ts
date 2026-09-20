import Redis from "ioredis";
import { env } from "./env";

/**
 * Redis singleton — dipakai untuk cache-aside, rate limiting, distributed
 * lock, dan sebagai backend BullMQ (docs/08-CACHE-SPEC.md, 09-QUEUE-WORKER-SPEC.md).
 *
 * PENTING: Redis BUKAN source of truth. Kode yang bergantung pada Redis harus
 * selalu punya fallback ke PostgreSQL saat Redis unavailable (NFR-AVAIL-001) —
 * lihat withCacheFallback() di bawah untuk pola standar yang wajib dipakai.
 */

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  // env.REDIS_URL sudah divalidasi oleh src/lib/env.ts saat aplikasi start.
  const client = new Redis(env.REDIS_URL, {
    // Jangan biarkan request menggantung lama saat Redis down — biar cepat
    // fallback ke PostgreSQL daripada menahan latensi API attendance.
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
    retryStrategy(times) {
      // Backoff, tapi tidak pernah menyerah permanen — reconnect otomatis.
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
  });

  client.on("error", (err) => {
    // Sengaja tidak melempar error di sini — kegagalan Redis tidak boleh
    // mematikan proses APP (NFR-AVAIL-001). Logger structured, bukan console.
    // eslint-disable-next-line no-console
    console.error({ msg: "redis_connection_error", error: err.message });
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Pola cache-aside standar dengan fallback wajib ke sumber data asli
 * (biasanya PostgreSQL) saat Redis bermasalah. Gunakan ini alih-alih
 * memanggil redis.get/set langsung di tiap endpoint, supaya perilaku
 * fallback konsisten di seluruh codebase.
 */
export async function withCacheFallback<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    // Cache miss karena Redis down dianggap cache miss biasa — lanjut ke loader.
    console.warn({ msg: "redis_read_failed_fallback_to_source", key });
  }

  const fresh = await loader();

  try {
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  } catch (err) {
    // Gagal menulis cache tidak boleh menggagalkan response ke klien.
    console.warn({ msg: "redis_write_failed_ignored", key });
  }

  return fresh;
}

/** Hapus satu atau beberapa cache key sekaligus (untuk invalidasi setelah mutasi). */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn({ msg: "redis_invalidate_failed", keys });
  }
}
