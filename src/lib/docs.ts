import { isDate } from "./validate";
// Querra Fleet: starea documentelor și pragurile de reamintire. Pure; testate în smoke:docs.
export type DocStatus = "valid" | "soon" | "urgent" | "expired" | "unknown";
export type Stage = "d30" | "d14" | "d7" | "d1" | "d0";
export const STAGES: [Stage, number][] = [["d0", 0], ["d1", 1], ["d7", 7], ["d14", 14], ["d30", 30]];
/** Zile întregi de la `today` (YYYY-MM-DD) până la `expires` (YYYY-MM-DD); negativ = expirat. */
export const daysLeft = (expires: string, today: string) => !isDate(expires) || !isDate(today) ? NaN : Math.round((Date.parse(expires + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
/** valid > 30 zile · soon ≤ 30 · urgent ≤ 7 · expired < 0 (în ziua expirării e încă „urgent”). */
export function docStatus(expires: string, today: string): { days: number; status: DocStatus } {
  const days = daysLeft(expires, today);
  return { days, status: !Number.isFinite(days) ? "unknown" : days < 0 ? "expired" : days <= 7 ? "urgent" : days <= 30 ? "soon" : "valid" };
}
/** Pragul curent: cel mai strâns prag atins (30/14/7/1 zile, apoi „la expirare”). Doar acesta se trimite, chiar dacă jobul a sărit zile. */
export function stageFor(days: number): Stage | null {
  for (const [s, n] of STAGES) if (days <= n) return s;
  return null;
}
export const STATUS_CLASS: Record<DocStatus, string> = { unknown: "warn", valid: "ok", soon: "warn", urgent: "bad", expired: "bad" };
export const STATUS_COLOR: Record<DocStatus, string> = { unknown: "#f5a524", valid: "var(--pos)", soon: "#f5a524", urgent: "var(--neg)", expired: "var(--neg)" };

export interface RDoc { id: string; type: string; expires: string; truckId: string | null; userId: string | null; label: string }
export interface RUser { id: string; role: "owner" | "driver"; email: string | null; truckId?: string | null }
export interface Reminder { key: string; docId: string; stage: Stage; days: number; userId: string | null; email: string | null }
/**
 * Reamintirile datorate azi. Destinatari: proprietarul (userId null în clopoțel + email la fiecare proprietar cu email),
 * șoferul titular (documentele lui) și șoferii al căror camion curent e camionul documentului.
 * key = doc:expirare:prag:destinatar → idempotent (rularea de două ori nu dublează nimic).
 */
export function dueReminders(docs: RDoc[], users: RUser[], today: string): Reminder[] {
  const out: Reminder[] = [];
  for (const d of docs) {
    const days = daysLeft(d.expires, today), stage = stageFor(days);
    if (!stage) continue;
    const base = `${d.id}:${d.expires}:${stage}`;
    out.push({ key: `${base}:owner`, docId: d.id, stage, days, userId: null, email: null });
    for (const u of users) {
      if (u.role === "owner" && u.email) out.push({ key: `${base}:mail:${u.id}`, docId: d.id, stage, days, userId: u.id, email: u.email });
      if (u.role === "driver" && (d.userId === u.id || (d.truckId && u.truckId === d.truckId))) {
        out.push({ key: `${base}:${u.id}`, docId: d.id, stage, days, userId: u.id, email: null });
        if (u.email) out.push({ key: `${base}:mail:${u.id}`, docId: d.id, stage, days, userId: u.id, email: u.email });
      }
    }
  }
  return out;
}
