import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me (FR-AUTH-004)
 * Mengambil profil pengguna yang sedang login berdasarkan JWT session cookie.
 */
export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req);

  // 1. Coba ambil dari Database PostgreSQL jika aktif
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        role: { select: { code: true } },
        homeroomClassId: true,
      },
    });

    if (user && user.isActive) {
      return NextResponse.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.code,
        homeroomClassId: user.homeroomClassId,
      });
    }
  } catch {
    // Database offline — gunakan data sesi JWT
  }

  // 2. Fallback: Kembalikan informasi dasar dari verified token
  return NextResponse.json({
    id: session.userId,
    role: session.role,
    authenticated: true,
  });
});
