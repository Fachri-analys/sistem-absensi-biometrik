import { PrismaClient } from "@prisma/client";
import { env } from "./env";

/**
 * Prisma Client singleton.
 *
 * Kenapa perlu singleton: Next.js dev mode melakukan hot-reload modul, dan
 * setiap reload yang membuat PrismaClient baru akan membuka koneksi baru ke
 * PostgreSQL tanpa menutup yang lama — kalau tidak di-singleton-kan, ini
 * cepat menghabiskan connection pool DB bahkan di development.
 *
 * Di production (serverless/container biasa), instance ini dibuat sekali per
 * proses dan dipakai ulang di seluruh request pada proses yang sama —
 * konsisten dengan prinsip backend stateless (APP tidak menyimpan state per
 * request, tapi koneksi DB pool memang harus dikelola per proses).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
