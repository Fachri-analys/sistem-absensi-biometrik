import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import { env } from "./env";
import type { RoleCode } from "@prisma/client";

/**
 * FR-AUTH-001..005, docs/06-SECURITY-SPEC.md
 *
 * - Password di-hash dengan bcrypt (cost factor 12 — memadai untuk 2024+
 *   tanpa membuat login terasa lambat).
 * - Session token berupa JWT bertanda tangan (HS256) dengan masa berlaku
 *   pendek. Klaim MINIMAL: userId, role, exp — tidak ada data sensitif di
 *   payload token (NFR-SEC di 06-SECURITY-SPEC.md, "Token Security").
 */

const BCRYPT_COST_FACTOR = 12;
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 jam — nilai default, dapat disesuaikan kebijakan sekolah.

export interface SessionPayload extends JWTPayload {
  userId: string;
  role: RoleCode;
}

function getSigningKey(): Uint8Array {
  // env.SESSION_SECRET sudah divalidasi (min. 32 karakter) oleh src/lib/env.ts
  // saat aplikasi start — tidak perlu validasi ulang di sini.
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export async function createSessionToken(
  userId: string,
  role: RoleCode
): Promise<string> {
  return new SignJWT({ userId, role } satisfies Omit<SessionPayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

/**
 * Memverifikasi token. Melempar error jika invalid/kedaluwarsa — pemanggil
 * WAJIB menangani ini sebagai 401, bukan membiarkan exception bocor ke klien
 * sebagai 500 (lihat src/lib/api-errors.ts).
 */
export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSigningKey());
  if (typeof payload.userId !== "string" || typeof payload.role !== "string") {
    throw new Error("Token payload tidak valid.");
  }
  return payload as SessionPayload;
}

export const SESSION_COOKIE_NAME = "absensi_session";
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;
