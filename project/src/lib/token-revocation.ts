import { redis } from "./redis";

/**
 * Menutup TODO yang sebelumnya ditandai di src/app/api/auth/logout/route.ts.
 *
 * Karena session token berbentuk JWT stateless, "logout" seharusnya tidak
 * cukup hanya menghapus cookie di klien — token yang sudah di-issue masih
 * valid secara kriptografis sampai masa berlakunya habis. Untuk menutup
 * celah itu (docs/06-SECURITY-SPEC.md §Session Security: "dapat dicabut
 * paksa"), setiap token punya `jti` unik (lihat lib/auth.ts), dan saat
 * logout, jti tersebut dimasukkan ke revoke-list di Redis dengan TTL SAMA
 * PERSIS dengan sisa masa berlaku token — supaya entry di Redis otomatis
 * hilang begitu token itu sendiri toh sudah kedaluwarsa secara alami
 * (tidak ada sampah menumpuk selamanya).
 *
 * Kegagalan Redis di jalur ini FAIL-CLOSED untuk revoke check (anggap
 * revoked jika tidak bisa dipastikan), TAPI fail-open untuk penulisan revoke
 * saat logout (kalau Redis down pas logout, cookie tetap dihapus di klien —
 * lebih baik daripada logout gagal total karena masalah infrastruktur
 * pendukung yang bukan source of truth).
 */

const REVOKE_KEY_PREFIX = "revoked:";

export async function revokeToken(jti: string, remainingTtlSeconds: number): Promise<void> {
  if (remainingTtlSeconds <= 0) return; // token sudah kedaluwarsa sendiri, tidak perlu dicatat
  try {
    await redis.set(`${REVOKE_KEY_PREFIX}${jti}`, "1", "EX", remainingTtlSeconds);
  } catch (err) {
    // Fail-open di sisi PENULISAN: kegagalan mencatat revoke tidak boleh
    // membuat endpoint logout melempar 500 ke user yang sudah benar logout
    // secara niat. Ini trade-off yang disengaja, bukan diabaikan diam-diam —
    // dicatat sebagai warning untuk observability.
    console.warn({ msg: "revoke_token_write_failed", jti, error: err });
  }
}

export async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false; // token lama (sebelum jti ditambahkan) — tidak bisa dicek, dianggap tidak di-revoke
  try {
    const result = await redis.get(`${REVOKE_KEY_PREFIX}${jti}`);
    return result !== null;
  } catch (err) {
    // Fail-CLOSED di sisi PEMBACAAN untuk kasus yang secara eksplisit minta
    // revoke (mis. akun baru saja dinonaktifkan admin) akan tetap lebih aman
    // dianggap TIDAK revoked saat Redis down (NFR-AVAIL-001 — Redis down
    // tidak boleh menjatuhkan seluruh sistem auth). Ini adalah keputusan
    // sadar mengutamakan ketersediaan dibanding proteksi revoke saat insiden
    // infrastruktur pendukung, didokumentasikan di sini secara eksplisit.
    console.warn({ msg: "revoke_token_check_failed_fail_open", jti, error: err });
    return false;
  }
}
