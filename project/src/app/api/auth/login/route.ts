import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { withErrorHandling, Errors, ApiError } from "@/lib/api-errors";
import { parseOrThrow, loginSchema } from "@/lib/validation";
import { checkRateLimit, RateLimitPresets } from "@/lib/rate-limit";
import { recordAudit, getClientIp } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { authenticateUser, OFFICIAL_SCHOOL_DOMAIN } from "@/lib/auth-security";
import { RoleCode } from "@prisma/client";

export const dynamic = "force-dynamic";

const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8vHwWuXCEWuvcKUM3D6IZ8LWiK5nXW";

export const POST = withErrorHandling(async (req: Request) => {
  const ip = getClientIp(req) ?? "unknown";
  const body = parseOrThrow(loginSchema, await req.json().catch(() => ({})));

  const rawIdentifier = (body.identifier || body.email || "").trim();
  const password = body.password;
  const requestedRole = body.role || (rawIdentifier.includes("@") ? "admin" : "siswa");

  const rateLimit = RateLimitPresets.loginPerIpEmail(ip, rawIdentifier);
  await checkRateLimit(rateLimit.key, rateLimit.limit, rateLimit.windowSeconds);

  // 1. Validasi format spesifik per Role (Aturan Institusi SMKN 11)
  if (requestedRole === "siswa") {
    if (rawIdentifier.includes("@")) {
      throw new ApiError(400, "BAD_REQUEST", "Siswa hanya dapat login menggunakan NISN. Penggunaan email dilarang.");
    }
  } else if (requestedRole === "guru") {
    if (rawIdentifier.includes("@")) {
      throw new ApiError(400, "BAD_REQUEST", "Guru hanya dapat login menggunakan NIP. Penggunaan email dilarang.");
    }
  } else if (requestedRole === "admin") {
    if (!rawIdentifier.toLowerCase().endsWith(OFFICIAL_SCHOOL_DOMAIN)) {
      throw Errors.forbidden(
        `Akses Admin ditolak: Wajib menggunakan email resmi sekolah (${OFFICIAL_SCHOOL_DOMAIN}).`
      );
    }
  }

  let authenticatedUser: {
    id: string;
    identifier: string;
    fullName: string;
    role: RoleCode;
    userRoleLabel: "siswa" | "guru" | "admin";
  } | null = null;

  // 2. Coba autentikasi via Database PostgreSQL jika tersedia
  try {
    if (requestedRole === "admin" || rawIdentifier.includes("@")) {
      const user = await prisma.user.findUnique({
        where: { email: rawIdentifier.toLowerCase(), deletedAt: null },
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
        password,
        user?.passwordHash ?? DUMMY_HASH
      );

      if (user && user.isActive && passwordValid) {
        authenticatedUser = {
          id: user.id,
          identifier: user.email,
          fullName: user.fullName,
          role: user.role.code,
          userRoleLabel: "admin",
        };
      }
    } else if (requestedRole === "guru") {
      const teacher = await prisma.teacher.findUnique({
        where: { nip: rawIdentifier, deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              passwordHash: true,
              isActive: true,
              role: { select: { code: true } },
            },
          },
        },
      });

      if (teacher?.user && teacher.user.isActive) {
        const passwordValid = await verifyPassword(password, teacher.user.passwordHash);
        if (passwordValid) {
          authenticatedUser = {
            id: teacher.user.id,
            identifier: teacher.nip ?? rawIdentifier,
            fullName: teacher.fullName,
            role: teacher.user.role.code,
            userRoleLabel: "guru",
          };
        }
      }
    } else if (requestedRole === "siswa") {
      const student = await prisma.student.findUnique({
        where: { nisn: rawIdentifier, deletedAt: null, isActive: true },
        select: { id: true, nisn: true, fullName: true },
      });

      if (student) {
        // Siswa terdaftar di database
        authenticatedUser = {
          id: student.id,
          identifier: student.nisn,
          fullName: student.fullName,
          role: RoleCode.VIEWER,
          userRoleLabel: "siswa",
        };
      }
    }
  } catch (dbErr) {
    logger.warn({ msg: "database_auth_fallback", error: String(dbErr) });
  }

  // 3. Fallback: Autentikasi Kredensial Resmi / Terenkripsi (Mock Data Engine)
  if (!authenticatedUser) {
    const securityCheck = await authenticateUser(rawIdentifier, password, requestedRole);
    if (securityCheck.success && securityCheck.user) {
      const assignedRoleCode: RoleCode =
        requestedRole === "admin"
          ? RoleCode.ADMIN
          : requestedRole === "guru"
          ? RoleCode.WALI_KELAS
          : RoleCode.VIEWER;

      authenticatedUser = {
        id: securityCheck.user.id,
        identifier: securityCheck.user.identifier,
        fullName: securityCheck.user.nama,
        role: assignedRoleCode,
        userRoleLabel: requestedRole,
      };
    }
  }

  // 4. Verifikasi Gagal
  if (!authenticatedUser) {
    await recordAudit({
      actorUserId: null,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: rawIdentifier,
      ipAddress: ip,
    });
    logger.warn({ msg: "login_failed", identifier: rawIdentifier, role: requestedRole, ip });
    throw Errors.unauthorized(
      requestedRole === "siswa"
        ? "NISN atau kata sandi tidak valid."
        : requestedRole === "guru"
        ? "NIP atau kata sandi tidak valid."
        : "Email atau kata sandi admin tidak valid."
    );
  }

  // 5. Buat JWT Session Token
  const token = await createSessionToken(authenticatedUser.id, authenticatedUser.role);

  await recordAudit({
    actorUserId: authenticatedUser.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: authenticatedUser.id,
    ipAddress: ip,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: authenticatedUser.id,
      identifier: authenticatedUser.identifier,
      fullName: authenticatedUser.fullName,
      role: authenticatedUser.userRoleLabel,
      roleCode: authenticatedUser.role,
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
