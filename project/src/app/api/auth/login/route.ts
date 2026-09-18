import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { parseOrThrow, loginSchema } from "@/lib/validation";
import { checkRateLimit, RateLimitPresets } from "@/lib/rate-limit";
import { recordAudit, getClientIp } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";


/**
 * POST /api/auth/login (docs/05-API-SPEC.md, FR-AUTH-001, FR-AUTH-002)
 *
 * Urutan penting untuk keamanan:
 * 1. Rate limit DULU (sebelum query DB) — mencegah brute force membebani DB.
 * 2. Selalu jalankan bcrypt.compare meski user tidak ditemukan (dengan hash
 *    dummy) — mencegah timing attack yang bisa membedakan "email tidak ada"
 *    vs "password salah" dari selisih waktu respons.
 * 3. Pesan error login SELALU generik ("email atau password salah"), tidak
 *    pernah membedakan mana yang salah — mencegah user enumeration.
 */

// Hash dummy dengan cost factor sama seperti hash asli, supaya waktu
// verifikasi konsisten baik user ada maupun tidak ada.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8vHwWuXCEWuvcKUM3D6IZ8LWiK5nXW";

export const POST = withErrorHandling(async (req: Request) => {
  const ip = getClientIp(req) ?? "unknown";
  const body = parseOrThrow(loginSchema, await req.json().catch(() => ({})));

  const rateLimit = RateLimitPresets.loginPerIpEmail(ip, body.email);
  await checkRateLimit(rateLimit.key, rateLimit.limit, rateLimit.windowSeconds);

  const user = await prisma.user.findUnique({
    where: { email: body.email, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      passwordHash: true,
      isActive: true,
      role: { select: { code: true } },
    },
  });

  const passwordValid = await verifyPassword(
    body.password,
    user?.passwordHash ?? DUMMY_HASH
  );

  if (!user || !user.isActive || !passwordValid) {
    await recordAudit({
      actorUserId: user?.id ?? null,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id ?? body.email,
      ipAddress: ip,
    });
    logger.warn({ msg: "login_failed", email: body.email, ip });
    throw Errors.unauthorized("Email atau password salah.");
  }

  const token = await createSessionToken(user.id, user.role.code);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit({
    actorUserId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
    ipAddress: ip,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
});
