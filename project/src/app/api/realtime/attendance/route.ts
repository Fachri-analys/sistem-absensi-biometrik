import { requireAuth } from "@/lib/require-auth";
import { resolveClassScopeOrThrow } from "@/lib/scope";
import {
  createAttendanceSubscriber,
  REALTIME_ATTENDANCE_CHANNEL,
  type AttendanceRealtimeEvent,
} from "@/lib/realtime";
import { apiErrorResponse } from "@/lib/api-errors";
import { logger } from "@/lib/logger";

/**
 * GET /api/realtime/attendance (FR-SYNC-REALTIME-001, docs/03-SAD.md)
 *
 * SSE dipilih dibanding WebSocket penuh untuk Phase 9 karena:
 * - Next.js App Router Route Handler mendukung streaming response native
 *   (ReadableStream) tanpa perlu server WS terpisah/custom server.
 * - Arah data hanya satu jalur (server → klien) — dashboard tidak perlu
 *   mengirim apa pun balik lewat channel ini, jadi SSE sudah cukup dan
 *   lebih sederhana untuk dijaga benar dibanding WebSocket.
 * - Auto-reconnect bawaan browser (EventSource) mengurangi kebutuhan logic
 *   reconnect manual di frontend.
 *
 * Kegagalan koneksi ini TIDAK BOLEH dianggap sebagai kegagalan sistem —
 * dashboard tetap punya fallback polling REST ke /api/attendance/latest dan
 * /api/dashboard/stats (NFR-AVAIL-001).
 *
 * runtime nodejs WAJIB (bukan edge) karena ioredis butuh Node.js APIs.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // jangan pernah di-cache oleh Next.js/CDN

const HEARTBEAT_INTERVAL_MS = 25000; // jaga koneksi tetap hidup melewati proxy/load balancer timeout

export async function GET(req: Request): Promise<Response> {
  let session;
  try {
    session = await requireAuth(req, [
      "ADMIN",
      "OPERATOR",
      "WALI_KELAS",
      "VIEWER",
      "SUPER_ADMIN",
    ]);
  } catch (err) {
    return apiErrorResponse(err);
  }

  const url = new URL(req.url);
  let effectiveClassId: string | undefined;
  try {
    effectiveClassId = await resolveClassScopeOrThrow(
      session,
      url.searchParams.get("classId") ?? undefined
    );
  } catch (err) {
    return apiErrorResponse(err);
  }

  const log = logger.child({ userId: session.userId, endpoint: "realtime/attendance" });
  const subscriber = createAttendanceSubscriber();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown): void {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      send("connected", { classId: effectiveClassId ?? null });

      const heartbeat = setInterval(() => {
        // Komentar SSE (diawali ":") tidak memicu event di klien, hanya
        // menjaga koneksi tetap hidup melewati proxy yang menutup koneksi idle.
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_INTERVAL_MS);

      subscriber.on("message", (_channel, message) => {
        try {
          const event = JSON.parse(message) as AttendanceRealtimeEvent;

          // WALI_KELAS hanya menerima event kelasnya sendiri — filter di sisi
          // server (defense in depth), bukan cuma di UI.
          if (effectiveClassId && event.classId !== effectiveClassId) {
            return;
          }

          send("attendance", event);
        } catch (err) {
          log.warn({ msg: "realtime_message_parse_failed", error: err });
        }
      });

      subscriber.on("error", (err) => {
        log.warn({ msg: "realtime_subscriber_error", error: err.message });
        // Tidak menutup stream di sini — ioredis akan mencoba reconnect
        // sendiri (lihat retryStrategy di lib/redis.ts, dipakai juga oleh
        // koneksi duplikat ini).
      });

      try {
        await subscriber.subscribe(REALTIME_ATTENDANCE_CHANNEL);
      } catch (err) {
        log.error({ msg: "realtime_subscribe_failed", error: err });
        clearInterval(heartbeat);
        // BUG YANG DIPERBAIKI: sebelumnya jalur ini langsung `controller.close()`
        // tanpa menutup koneksi `subscriber` yang sudah dibuat via
        // `redis.duplicate()` — setiap kegagalan subscribe (mis. Redis
        // sedang restart tepat saat klien connect) membocorkan satu koneksi
        // Redis yang tidak pernah ditutup. Di endpoint yang bisa dipanggil
        // berkali-kali oleh banyak dashboard, ini lama-lama menghabiskan
        // connection pool Redis.
        subscriber.disconnect();
        controller.close();
        return;
      }

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        subscriber.quit().catch(() => {
          /* koneksi mungkin sudah terputus, aman diabaikan */
        });
        controller.close();
        log.info({ msg: "realtime_client_disconnected" });
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
