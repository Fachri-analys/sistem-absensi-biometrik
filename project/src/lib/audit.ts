import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

/**
 * FR-AUDIT-001, NFR-AUDIT-001 (docs/02-SRS.md, docs/06-SECURITY-SPEC.md).
 *
 * PENTING: before/after snapshot TIDAK BOLEH memuat data biometrik
 * (embedding) atau password hash. Pemanggil bertanggung jawab mengirim
 * snapshot yang sudah "bersih" — helper ini menambahkan pengaman tambahan
 * dengan men-strip field yang dikenal sensitif, sebagai defense in depth,
 * bukan satu-satunya lapisan perlindungan.
 */

const NEVER_LOG_FIELDS = new Set([
  "passwordHash",
  "embeddingRef",
  "embeddingVersion",
  "apiKeyHash",
]);

function stripSensitiveFields(
  snapshot: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!snapshot) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!NEVER_LOG_FIELDS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeSnapshot: (stripSensitiveFields(entry.before) as Prisma.InputJsonValue) ?? undefined,
        afterSnapshot: (stripSensitiveFields(entry.after) as Prisma.InputJsonValue) ?? undefined,
        ipAddress: entry.ipAddress ?? undefined,
      },
    });
  } catch (err) {
    // Kegagalan audit log tidak boleh menggagalkan operasi utama, tapi harus
    // terlihat jelas di monitoring — ini adalah kondisi yang perlu alert
    // (docs/12-OPERATIONS.md), bukan silent failure.
    // eslint-disable-next-line no-console
    console.error({ msg: "audit_log_write_failed", entry: { ...entry, before: undefined, after: undefined }, error: err });
  }
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return null;
}
