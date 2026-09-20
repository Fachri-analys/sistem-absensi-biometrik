import { NextResponse } from "next/server";

/**
 * Format error standar sesuai docs/05-API-SPEC.md:
 * { "error": { "code": string, "message": string, "details"?: object } }
 *
 * PENTING: pesan error yang dikirim ke klien TIDAK BOLEH memuat stack trace
 * atau detail internal (query SQL, path file, dsb) — lihat docs/02-SRS.md §17
 * Error Handling. Detail teknis lengkap tetap di-log secara internal.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  unauthorized: (message = "Autentikasi diperlukan.") =>
    new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Anda tidak memiliki akses untuk operasi ini.") =>
    new ApiError(403, "FORBIDDEN", message),
  notFound: (entity = "Data") =>
    new ApiError(404, "NOT_FOUND", `${entity} tidak ditemukan.`),
  validation: (details: Record<string, unknown>) =>
    new ApiError(400, "VALIDATION_ERROR", "Input tidak valid.", details),
  conflict: (message: string) => new ApiError(409, "CONFLICT", message),
  tooManyRequests: (message = "Terlalu banyak permintaan, coba lagi nanti.") =>
    new ApiError(429, "RATE_LIMITED", message),
  unprocessable: (message: string) => new ApiError(422, "UNPROCESSABLE", message),
  internal: () =>
    new ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan pada server."),
};

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    );
  }

  // Error tak terduga: JANGAN bocorkan detail internal ke klien.
  // eslint-disable-next-line no-console
  console.error({ msg: "unhandled_api_error", error });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." } },
    { status: 500 }
  );
}

/**
 * Wrapper untuk route handler App Router — menangkap ApiError maupun error
 * tak terduga secara konsisten, supaya setiap route tidak perlu try/catch
 * berulang dengan format berbeda-beda.
 */
export function withErrorHandling(
  handler: (req: Request, ctx: any) => Promise<NextResponse>
) {
  return async (req: Request, ctx: any): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return apiErrorResponse(error);
    }
  };
}
