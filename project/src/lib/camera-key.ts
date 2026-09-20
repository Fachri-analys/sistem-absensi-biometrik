import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { env } from "./env";

/**
 * Kenapa BUKAN bcrypt untuk API key kamera:
 * bcrypt sengaja lambat & tidak deterministik (salt acak per hash), sehingga
 * tidak bisa dipakai untuk *lookup* "cari kamera dengan api key ini" secara
 * efisien di database — akan berakhir men-scan semua kamera dan bcrypt.compare
 * satu per satu (O(n) per request presensi, buruk untuk endpoint bertrafik
 * tinggi). Sebagai gantinya dipakai HMAC-SHA256 dengan secret server
 * (CAMERA_API_KEY_SALT) — deterministik sehingga bisa di-index dan dicari
 * langsung via WHERE api_key_hash = ?, tapi tetap tidak reversible tanpa
 * secret tersebut.
 */

export function hashCameraApiKey(rawKey: string): string {
  // env.CAMERA_API_KEY_SALT sudah divalidasi (min. 32 karakter) oleh
  // src/lib/env.ts saat aplikasi start.
  return createHmac("sha256", env.CAMERA_API_KEY_SALT).update(rawKey).digest("hex");
}

/** Constant-time compare untuk menghindari timing attack saat verifikasi manual. */
export function safeCompareHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Generate API key baru untuk kamera (ditampilkan sekali saat pembuatan). */
export function generateCameraApiKey(): string {
  // randomUUID diimpor eksplisit dari node:crypto — sebelumnya kode ini
  // memakai `crypto.randomUUID()` global (Web Crypto API dari lib "dom" di
  // tsconfig), yang KEBETULAN bekerja karena Node 20+ mengekspos `crypto`
  // secara global, tapi membingungkan karena file ini sudah meng-import dari
  // `node:crypto` untuk fungsi lain. Satu sumber impor, bukan dua cara
  // berbeda untuk hal yang sama.
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}
