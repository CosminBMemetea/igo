// Demo: tura și pauza privată se țin într-un cookie (depozitul demo e în memorie, per instanță serverless),
// ca „Privat” să nu se piardă la reîncărcare (GDPR: pauza privată trebuie să rămână privată).
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { Shift } from "./repo";
const C = "qf-dshift";
// valorile cookie trebuie să fie ASCII (diacriticele din note / nume de stații dau eroare 500 în antet) → JSON codat URI
const jset = (v: unknown) => encodeURIComponent(JSON.stringify(v));
function jget(name: string): Record<string, never> & { [k: string]: unknown } { const raw = cookies().get(name)?.value ?? "{}"; try { return JSON.parse(raw); } catch { try { return JSON.parse(decodeURIComponent(raw)); } catch { return {}; } } }
type Map = Record<string, Shift>;
const read = (): Map => { try { return jget(C) as Map; } catch { return {}; } };
export const demoShifts = (): Map => read();
export const demoShift = (vehicleId: string): Shift | null => read()[vehicleId] ?? null;
export function saveDemoShift(res: NextResponse, s: Shift) {
  const m = read(); m[s.vehicleId] = s;
  res.cookies.set(C, jset(m), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
  return res;
}

/** Demo: ultima alimentare trimisă de șofer (doar în cookie-ul vizitatorului, nu în memoria comună). */
const F = "qf-dfill";
export const demoLastFill = (vehicleId: string): { litres: number; station: string } | null => { try { return (jget(F) as Record<string, { litres: number; station: string }>)[vehicleId] ?? null; } catch { return null; } };
export function saveDemoFill(res: NextResponse, vehicleId: string, litres: number, station: string) {
  let m: Record<string, { litres: number; station: string }> = {};
  try { m = jget(F); } catch {}
  m[vehicleId] = { litres, station: station.slice(0, 60) };
  res.cookies.set(F, jset(m), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
  return res;
}

/** Demo: bonurile trimise de șofer în sesiunea demo a acestui browser (cookie, 24 h). Patronul le vede în /receipts.
 *  Nimic pe server/DB. Se resetează la 24 h de la începutul sesiunii demo sau la logarea într-un cont real. */
export const DEMO_SID = "qf-dsid", FILLS = "qf-dfills", DEMO_TTL_S = 60 * 60 * 24;
export const DEMO_COOKIES = [C, F, FILLS, DEMO_SID, "qf-dreact", "qf-dres"];
export interface DemoFill { id: string; v: string; t: string; l: number; o: number; a: number | null; c: string | null; r: number | null; s: string; p?: number }
export function demoFills(): DemoFill[] {
  const sid = cookies().get(DEMO_SID)?.value;
  if (!sid) return [];
  try { const j = jget(FILLS) as { sid?: string; f?: DemoFill[] }; return j.sid === sid && Array.isArray(j.f) ? j.f : []; } catch { return []; }
}
/** adaugă bonul; același vehicul+litri+km → duplicat (ca în modul real) */
export function addDemoFill(res: NextResponse, f: Omit<DemoFill, "id">): { dup: boolean; id?: string } {
  const sid = cookies().get(DEMO_SID)?.value ?? Math.random().toString(36).slice(2, 10);
  if (!cookies().get(DEMO_SID)) res.cookies.set(DEMO_SID, sid, { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  const cur = demoFills();
  if (cur.some((x) => x.v === f.v && x.l === f.l && x.o === f.o)) return { dup: true };
  const id = `df-${Date.now().toString(36)}`;
  const list = [...cur, { ...f, s: f.s.slice(0, 50), id, ...(f.p ? { p: 1 } : {}) }].slice(-12);
  res.cookies.set(FILLS, jset({ sid, f: list }), { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  return { dup: false, id };
}
/** începe o sesiune demo nouă (id nou → bonurile/tura vechi nu mai apar) */
export function newDemoSession(res: NextResponse) {
  for (const c of [C, F, FILLS, "qf-dreact", "qf-dres"]) res.cookies.set(c, "", { path: "/", maxAge: 0 });
  res.cookies.set(DEMO_SID, Math.random().toString(36).slice(2, 10), { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  return res;
}
export function clearDemo(res: NextResponse) { for (const c of DEMO_COOKIES) res.cookies.set(c, "", { path: "/", maxAge: 0 }); return res; }

/** Demo: aplauze 👏 de la patron (cookie al sesiunii demo; șoferul le vede pe /driver). */
const RX = "qf-dreact";
export interface DemoReaction { id: string; v: string; l: string; t: string }
export function demoReactions(): DemoReaction[] {
  const sid = cookies().get(DEMO_SID)?.value; if (!sid) return [];
  try { const j = jget(RX) as { sid?: string; r?: DemoReaction[] }; return j.sid === sid && Array.isArray(j.r) ? j.r : []; } catch { return []; }
}
export function addDemoReaction(res: NextResponse, x: { id: string; v: string; l: string; on: boolean }) {
  const sid = cookies().get(DEMO_SID)?.value ?? Math.random().toString(36).slice(2, 10);
  if (!cookies().get(DEMO_SID)) res.cookies.set(DEMO_SID, sid, { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  const cur = demoReactions().filter((r) => r.id !== x.id);
  const list = x.on ? [...cur, { id: x.id, v: x.v, l: x.l, t: new Date().toISOString().slice(0, 16) }].slice(-15) : cur;
  res.cookies.set(RX, jset({ sid, r: list }), { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
}

/** Demo: avertizări rezolvate de patron (furt confirmat / alarmă falsă, document nou, „am vorbit, e ok”). Doar cookie-ul sesiunii demo. */
const RS = "qf-dres";
export type ResAction = "confirm" | "false" | "upload" | "ok";
export interface DemoRes { id: string; a: ResAction; n?: string; t: string }
export function demoResolved(): Record<string, DemoRes> {
  const sid = cookies().get(DEMO_SID)?.value; if (!sid) return {};
  try { const j = jget(RS) as { sid?: string; r?: DemoRes[] }; return j.sid === sid && Array.isArray(j.r) ? Object.fromEntries(j.r.map((x) => [x.id, x])) : {}; } catch { return {}; }
}
export function setDemoResolved(res: NextResponse, id: string, a: ResAction | null, n?: string) {
  const sid = cookies().get(DEMO_SID)?.value ?? Math.random().toString(36).slice(2, 10);
  if (!cookies().get(DEMO_SID)) res.cookies.set(DEMO_SID, sid, { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
  const cur = Object.values(demoResolved()).filter((x) => x.id !== id);
  const list = a ? [...cur, { id, a, ...(n ? { n: n.slice(0, 140) } : {}), t: new Date().toISOString().slice(0, 16) }].slice(-20) : cur;
  res.cookies.set(RS, jset({ sid, r: list }), { path: "/", maxAge: DEMO_TTL_S, sameSite: "lax", httpOnly: true });
}
