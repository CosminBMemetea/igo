// Demo: tura și pauza privată se țin într-un cookie (depozitul demo e în memorie, per instanță serverless),
// ca „Privat” să nu se piardă la reîncărcare (GDPR: pauza privată trebuie să rămână privată).
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { Shift } from "./repo";
const C = "qf-dshift";
type Map = Record<string, Shift>;
const read = (): Map => { try { return JSON.parse(cookies().get(C)?.value ?? "{}") as Map; } catch { return {}; } };
export const demoShifts = (): Map => read();
export const demoShift = (vehicleId: string): Shift | null => read()[vehicleId] ?? null;
export function saveDemoShift(res: NextResponse, s: Shift) {
  const m = read(); m[s.vehicleId] = s;
  res.cookies.set(C, JSON.stringify(m), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
  return res;
}

/** Demo: ultima alimentare trimisă de șofer (doar în cookie-ul vizitatorului, nu în memoria comună). */
const F = "qf-dfill";
export const demoLastFill = (vehicleId: string): { litres: number; station: string } | null => { try { return (JSON.parse(cookies().get(F)?.value ?? "{}") as Record<string, { litres: number; station: string }>)[vehicleId] ?? null; } catch { return null; } };
export function saveDemoFill(res: NextResponse, vehicleId: string, litres: number, station: string) {
  let m: Record<string, { litres: number; station: string }> = {};
  try { m = JSON.parse(cookies().get(F)?.value ?? "{}"); } catch {}
  m[vehicleId] = { litres, station: station.slice(0, 60) };
  res.cookies.set(F, JSON.stringify(m), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
  return res;
}

/** Demo: bonurile trimise de șofer în sesiunea demo a acestui browser (cookie, 24 h). Patronul le vede în /receipts.
 *  Nimic pe server/DB. Se resetează la 24 h de la începutul sesiunii demo sau la logarea într-un cont real. */
export const DEMO_SID = "qf-dsid", FILLS = "qf-dfills", DEMO_TTL_S = 60 * 60 * 24;
export const DEMO_COOKIES = [C, F, FILLS, DEMO_SID];
export interface DemoFill { id: string; v: string; t: string; l: number; o: number; a: number | null; c: string | null; r: number | null; s: string; p?: number }
export function demoFills(): DemoFill[] {
  const sid = cookies().get(DEMO_SID)?.value;
  if (!sid) return [];
  try { const j = JSON.parse(cookies().get(FILLS)?.value ?? "{}") as { sid?: string; f?: DemoFill[] }; return j.sid === sid && Array.isArray(j.f) ? j.f : []; } catch { return []; }
}
/** adaugă bonul; același vehicul+litri+km → duplicat (ca în modul real) */
export function addDemoFill(res: NextResponse, f: Omit<DemoFill, "id">): { dup: boolean; id?: string } {
  const sid = cookies().get(DEMO_SID)?.value ?? Math.random().toString(36).slice(2, 10);
  if (!cookies().get(DEMO_SID)) res.cookies.set(DEMO_SID, sid, { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  const cur = demoFills();
  if (cur.some((x) => x.v === f.v && x.l === f.l && x.o === f.o)) return { dup: true };
  const id = `df-${Date.now().toString(36)}`;
  const list = [...cur, { ...f, s: f.s.slice(0, 50), id, ...(f.p ? { p: 1 } : {}) }].slice(-12);
  res.cookies.set(FILLS, JSON.stringify({ sid, f: list }), { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  return { dup: false, id };
}
/** începe o sesiune demo nouă (id nou → bonurile/tura vechi nu mai apar) */
export function newDemoSession(res: NextResponse) {
  for (const c of [C, F, FILLS]) res.cookies.set(c, "", { path: "/", maxAge: 0 });
  res.cookies.set(DEMO_SID, Math.random().toString(36).slice(2, 10), { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  return res;
}
export function clearDemo(res: NextResponse) { for (const c of DEMO_COOKIES) res.cookies.set(c, "", { path: "/", maxAge: 0 }); return res; }
