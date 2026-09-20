import type { RoleCode } from "@prisma/client";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "./auth";
import { Errors } from "./api-errors";
import { isTokenRevoked } from "./token-revocation";
import { checkRateLimit, RateLimitPresets } from "./rate-limit";

/**
 * FR-AUTH-005: setiap endpoint memiliki daftar role yang diizinkan; request
 * dari role yang tidak sesuai HARUS ditolak dengan 403 SEBELUM logic bisnis
 * apa pun dijalankan — bukan divalidasi belakangan atau hanya disembunyikan
 * di UI (lihat docs/06-SECURITY-SPEC.md §Authorization).
 *
 * RATE LIMITING SENGAJA DITARUH DI SINI (bukan dipanggil manual per route):
 * audit produksi menemukan rate limiting hanya konsisten dipasang di 3 dari
 * 18 endpoint karena mengandalkan setiap route mengingat memanggilnya sendiri
 * — kelas bug yang sama akan terulang setiap kali endpoint baru ditambahkan.
 * Dengan menaruhnya di requireAuth() (dipanggil oleh SEMUA route
 * terautentikasi), cakupan rate limit terjamin otomatis tanpa bergantung pada
 * disiplin manual di tiap file. Endpoint yang butuh limit berbeda (mis. lebih
 * ketat) tetap bisa memanggil checkRateLimit() tambahan secara eksplisit di
 * atas ini.
 *
 * Pemakaian di route handler:
 *
 *   const session = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
 *
 * Jika role tidak sesuai atau token tidak valid, fungsi ini melempar ApiError
 * (401/403/429) yang akan ditangkap oleh withErrorHandling() di api-errors.ts.
 */
export async function requireAuth(
  req: Request,
  allowedRoles?: RoleCode[]
): Promise<SessionPayload> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = extractCookie(cookieHeader, SESSION_COOKIE_NAME);

  if (!token) {
    throw Errors.unauthorized();
  }

  let session: SessionPayload;
  try {
    session = await verifySessionToken(token);
  } catch {
    throw Errors.unauthorized("Sesi tidak valid atau sudah kedaluwarsa.");
  }

  if (await isTokenRevoked(session.jti)) {
    throw Errors.unauthorized("Sesi ini sudah dicabut (logout atau akun dinonaktifkan).");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    throw Errors.forbidden();
  }

  // Diterapkan SETELAH validasi role — request yang toh akan ditolak 403
  // tidak perlu ikut menghabiskan kuota rate limit user tersebut.
  const rateLimit = RateLimitPresets.apiPerUser(session.userId);
  await checkRateLimit(rateLimit.key, rateLimit.limit, rateLimit.windowSeconds);

  return session;
}

function extractCookie(cookieHeader: string, name: string): string | undefined {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

/**
 * Autentikasi khusus untuk kamera/edge device (bukan user), memakai header
 * X-Camera-Key alih-alih session cookie — sesuai docs/05-API-SPEC.md
 * (POST /api/attendance).
 *
 * Mengembalikan cameraId yang tervalidasi, bukan objek Camera penuh, supaya
 * pemanggil tetap mengambil data terbaru dari DB (menghindari data kamera
 * basi ikut terbawa dari proses autentikasi).
 *
 * Rate limit per kamera JUGA diterapkan di sini (bukan di tiap route yang
 * memanggilnya) dengan alasan konsistensi yang sama seperti requireAuth().
 */
export async function requireCameraAuth(
  req: Request,
  lookupCameraByKeyHash: (apiKey: string) => Promise<{ id: string; isActive: boolean } | null>
): Promise<string> {
  const apiKey = req.headers.get("x-camera-key");
  if (!apiKey) {
    throw Errors.unauthorized("Header X-Camera-Key diperlukan.");
  }

  const camera = await lookupCameraByKeyHash(apiKey);
  if (!camera || !camera.isActive) {
    throw Errors.unauthorized("API key kamera tidak valid.");
  }

  const rateLimit = RateLimitPresets.cameraPerDevice(camera.id);
  await checkRateLimit(rateLimit.key, rateLimit.limit, rateLimit.windowSeconds);

  return camera.id;
}
