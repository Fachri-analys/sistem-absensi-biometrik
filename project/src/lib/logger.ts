import pino from "pino";
import { env } from "./env";

/**
 * Structured logger (docs/12-OPERATIONS.md §2, docs/06-SECURITY-SPEC.md).
 *
 * WAJIB: field yang berkaitan dengan biometrik, password, atau token tidak
 * pernah boleh masuk log dalam bentuk apa pun — bukan hanya "sebisa mungkin
 * dihindari", tapi di-redact otomatis di level logger itu sendiri, supaya
 * satu baris kode yang lupa redact manual tidak membocorkan data sensitif.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "*.password",
      "*.passwordHash",
      "*.password_hash",
      "*.embedding",
      "*.embeddingRef",
      "*.embedding_ref",
      "*.token",
      "*.authorization",
      "*.apiKey",
      "*.api_key",
      "*.apiKeyHash",
      "req.headers.authorization",
      "req.headers['x-camera-key']",
    ],
    censor: "[REDACTED]",
  },
  transport:
    process.env.ENABLE_PINO_PRETTY === "true"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

/** Logger turunan dengan requestId, dipakai di setiap request handler. */
export function requestLogger(requestId: string, userId?: string) {
  return logger.child({ requestId, userId });
}
