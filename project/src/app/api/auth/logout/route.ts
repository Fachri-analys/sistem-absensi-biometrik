import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { revokeToken } from "@/lib/token-revocation";
import { recordAudit, getClientIp } from "@/lib/audit";
import { env } from "@/lib/env";

/**
 * POST /api/auth/logout (FR-AUTH-003).
 *
 * Token dimasukkan ke revoke-list Redis (lib/token-revocation.ts) dengan TTL
 * sama dengan sisa masa berlakunya, sehingga token yang sudah di-logout
 * benar-benar tidak bisa dipakai lagi sebelum masa berlaku alaminya habis —
 * bukan hanya mengandalkan penghapusan cookie di klien, yang tidak mencegah
 * token dipakai ulang jika sempat disalin/dicuri sebelum logout.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req);

  if (session.jti && typeof session.exp === "number") {
    const remainingSeconds = session.exp - Math.floor(Date.now() / 1000);
    await revokeToken(session.jti, remainingSeconds);
  }

  await recordAudit({
    actorUserId: session.userId,
    action: "LOGOUT",
    entityType: "User",
    entityId: session.userId,
    ipAddress: getClientIp(req),
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });

  return response;
});
