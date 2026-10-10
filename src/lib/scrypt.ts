import { scryptSync, timingSafeEqual } from "node:crypto";
// Format: scrypt:N:r:p:salt(b64):hash(b64) (fără „$”, ca să nu fie expandat în .env) — generat cu `npm run hash-password`.
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [alg, N, r, p, salt, hash] = stored.split(":");
  if (alg !== "scrypt" || !salt || !hash) return false;
  try {
    const want = Buffer.from(hash, "base64");
    const got = scryptSync(password, Buffer.from(salt, "base64"), want.length, { N: +N, r: +r, p: +p, maxmem: 256 * 1024 * 1024 });
    return got.length === want.length && timingSafeEqual(got, want);
  } catch { return false; }
}
export const adminConfigured = () => !!process.env.ADMIN_EMAIL && !!process.env.ADMIN_PASSWORD_HASH && (process.env.SESSION_SECRET?.length ?? 0) >= 32;
