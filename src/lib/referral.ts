// Cod de recomandare: derivat stabil din id-ul firmei (fără coloană nouă), 7 caractere fără 0/O/1/I.
import { createHash } from "node:crypto";
const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function refCode(firmId: string): string {
  const h = createHash("sha256").update(`qf-ref:${firmId}`).digest();
  let s = ""; for (let i = 0; i < 7; i++) s += AB[h[i] % AB.length];
  return s;
}
export const normRef = (v: unknown): string | null => { const s = String(v ?? "").trim().toUpperCase(); return /^[A-HJ-NP-Z2-9]{7}$/.test(s) ? s : null; };
export const firmByRef = <F extends { id: string }>(firms: F[], code: string | null) => (code ? firms.find((f) => refCode(f.id) === code) ?? null : null);
