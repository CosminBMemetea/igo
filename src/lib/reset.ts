// Resetare parolă patron: link semnat, valabil 1 h, de unică folosință (legat de hash-ul parolei curente).
import { createHash } from "node:crypto";
import { signToken, verifyToken } from "./session";
const ph = (hash: string) => createHash("sha256").update(hash).digest("hex").slice(0, 20);
export const resetToken = (uid: string, passwordHash: string, secret: string) => signToken({ k: "reset", uid, ph: ph(passwordHash), exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
export async function readReset(t: string | undefined, secret: string | undefined) {
  const p = await verifyToken<{ k: string; uid: string; ph: string; exp: number }>(t, secret);
  return p && p.k === "reset" ? p : null;
}
export const resetMatches = (p: { ph: string }, passwordHash: string) => p.ph === ph(passwordHash);
