import type { SessionPayload } from "./auth";
import { prisma } from "./prisma";
import { Errors } from "./api-errors";

/**
 * WALI_KELAS hanya boleh melihat data kelas yang diampu. Ini HARUS dipaksa
 * di query layer server (WHERE classId = ...), bukan hanya disembunyikan di
 * UI — lihat docs/05-API-SPEC.md catatan Authorization di setiap endpoint
 * Students/Attendance.
 *
 * Mengembalikan classId yang boleh diakses, atau null jika role tidak
 * dibatasi per kelas (ADMIN/SUPER_ADMIN/OPERATOR/VIEWER melihat semua,
 * dengan catatan VIEWER tetap read-only di level endpoint masing-masing).
 */
export async function resolveClassScopeOrThrow(
  session: SessionPayload,
  requestedClassId?: string
): Promise<string | undefined> {
  if (session.role !== "WALI_KELAS") {
    // Role lain: hormati filter classId yang diminta client apa adanya (atau
    // tidak difilter sama sekali jika tidak diberikan).
    return requestedClassId;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { homeroomClassId: true },
  });

  if (!user?.homeroomClassId) {
    // WALI_KELAS tanpa homeroomClassId adalah kondisi data tidak konsisten —
    // lebih aman menolak akses daripada mengembalikan data tanpa filter.
    throw Errors.forbidden("Akun wali kelas tidak terhubung ke kelas mana pun.");
  }

  if (requestedClassId && requestedClassId !== user.homeroomClassId) {
    throw Errors.forbidden("Anda hanya dapat mengakses data kelas yang Anda ampu.");
  }

  return user.homeroomClassId;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

/**
 * Menjalankan findMany + count secara PARALEL (Promise.all), bukan berurutan.
 * Ini pola wajib untuk semua endpoint list — menghindari dua round-trip
 * database yang berurutan padahal keduanya independen satu sama lain.
 */
export async function paginate<T>(
  { page, pageSize }: PaginationParams,
  runQueries: (args: { skip: number; take: number }) => {
    findMany: Promise<T[]>;
    count: Promise<number>;
  }
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * pageSize;
  const { findMany, count } = runQueries({ skip, take: pageSize });
  const [data, total] = await Promise.all([findMany, count]);
  return { data, meta: { page, pageSize, total } };
}
