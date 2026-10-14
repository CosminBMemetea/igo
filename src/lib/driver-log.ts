// Jurnalul șoferului (firmă reală) + „azi” corect: km din pozițiile GPS filtrate, ore din tură minus pauzele private.
import { store } from "./store";
import type { DriverEventKind, DriverEventRow, PosRow } from "./store/types";
import { localNow } from "./validate";
import { haversineKm, type LatLng } from "./fleet/data";

type Tn = { demo: boolean; firm?: { id: string } | null; uid?: string | null };
/** Nu blochează niciodată acțiunea șoferului: jurnalul e „best effort”. */
export async function logDriver(tn: Tn, truckId: string, kind: DriverEventKind, o: { at?: string; lat?: number | null; lng?: number | null; note?: string | null } = {}) {
  if (tn.demo || !tn.firm) return;
  try { await store().addDriverEvent(tn.firm.id, { truckId, userId: tn.uid ?? null, kind, at: o.at ?? new Date().toISOString(), lat: o.lat ?? null, lng: o.lng ?? null, note: o.note ?? null }); } catch { /* ignorăm */ }
}
/** Miezul nopții (Europe/Bucharest) de azi, ca ISO UTC — granița zilei pentru „azi”. */
export function dayStartIso(now = new Date()): string {
  const local = localNow(now), off = Date.parse(local + ":00Z") - Math.floor(now.getTime() / 60000) * 60000; // ora locală − UTC
  return new Date(Date.parse(local.slice(0, 10) + "T00:00:00Z") - off).toISOString();
}
const toMin = (at: string) => { const h = Number(at.slice(11, 13)), m = Number(at.slice(14, 16)); return h * 60 + m; };
/** Filtrează zgomotul GPS: pas minim 40 m, viteză implicită ≤ 150 km/h (coordonatele au rezoluție de minut). */
export function cleanTrack(ps: PosRow[]): { pts: { min: number; at: LatLng }[]; km: number } {
  const out: { min: number; at: LatLng; t: string }[] = []; let km = 0;
  for (const p of [...ps].sort((a, b) => a.at.localeCompare(b.at))) {
    const at: LatLng = [p.lat, p.lng], last = out[out.length - 1];
    if (!last) { out.push({ min: toMin(p.at), at, t: p.at }); continue; }
    const d = haversineKm(last.at, at), dtMin = Math.max(1, toMin(p.at) - last.min);
    if (d < 0.04) continue; // staționare / zgomot
    if ((d / dtMin) * 60 > 150 && d > 0.5) continue; // salt GPS imposibil
    km += d; out.push({ min: toMin(p.at), at, t: p.at });
  }
  return { pts: out.map(({ min, at }) => ({ min, at })), km };
}
/** Ore de lucru azi (Europe/Bucharest): reuniunea turelor de azi (jurnal + tura curentă), tăiată la miezul nopții, minus pauzele „Privat”. */
export function hoursToday(shift: { start: string; end: string | null; privateSince?: string | null } | null, events: DriverEventRow[], now = Date.now()): number {
  const d0 = Date.parse(dayStartIso(new Date(now))), ev = [...events].sort((x, y) => x.at.localeCompare(y.at));
  const work: [number, number][] = [], priv: [number, number][] = [];
  let ws: number | null = null, ps: number | null = null;
  for (const e of ev) {
    const t = Date.parse(e.at);
    if (e.kind === "shift_start") ws = t;
    else if (e.kind === "shift_end") { work.push([ws ?? d0, t]); ws = null; if (ps !== null) { priv.push([ps, t]); ps = null; } }
    else if (e.kind === "private_on") ps = ps ?? t;
    else if (e.kind === "private_off") { priv.push([ps ?? d0, t]); ps = null; }
  }
  if (shift) work.push([Date.parse(shift.start), shift.end ? Date.parse(shift.end) : now]);
  if (ws !== null && (!shift || shift.end)) work.push([ws, shift?.end ? Date.parse(shift.end) : now]);
  if (shift && !shift.end && shift.privateSince) priv.push([Date.parse(shift.privateSince), now]); else if (ps !== null) priv.push([ps, now]);
  const union = (xs: [number, number][]) => { const r: [number, number][] = []; for (const [a, b] of xs.map(([a, b]) => [Math.max(a, d0), Math.min(b, now)] as [number, number]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])) { const l = r[r.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else r.push([a, b]); } return r; };
  const W = union(work), P = union(priv);
  let ms = 0; for (const [a, b] of W) { ms += b - a; for (const [c, d] of P) ms -= Math.max(0, Math.min(b, d) - Math.max(a, c)); }
  return Math.max(0, ms / 3600000);
}
/** Azi pentru un camion: km (GPS filtrat), ore, ultima poziție. */
export async function truckToday(firmId: string, truckId: string, shift: Parameters<typeof hoursToday>[0]) {
  const s = store(), d0 = dayStartIso();
  const [pos, ev] = await Promise.all([s.positions(firmId, localNow(new Date(d0)).slice(0, 10) + "T00:00").catch(() => []), s.driverEvents(firmId, d0).catch(() => [])]);
  const mine = pos.filter((p) => p.truckId === truckId), tr = cleanTrack(mine);
  return { km: Math.round(tr.km * 10) / 10, hours: hoursToday(shift, ev.filter((e) => e.truckId === truckId)), track: tr.pts, last: mine.length ? mine.reduce((x, y) => (y.at > x.at ? y : x)) : null, events: ev.filter((e) => e.truckId === truckId) };
}
