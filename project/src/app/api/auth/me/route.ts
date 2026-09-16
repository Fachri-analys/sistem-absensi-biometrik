import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth } from "@/lib/require-auth";

/**
 * GET /api/auth/me (FR-AUTH-004).
 * Query tunggal dengan `select` eksplisit — tidak mengambil passwordHash,
 * dan tidak melakukan query terpisah untuk role (pakai relation select, satu
 * round-trip) untuk menghindari N+1 di endpoint yang paling sering dipanggil
 * (setiap load halaman dashboard biasanya cek sesi dulu).
 */
export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req);

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

  if (!user || !user.isActive) {
    throw Errors.unauthorized("Akun tidak ditemukan atau tidak aktif.");
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role.code,
    homeroomClassId: user.homeroomClassId,
  });
});
