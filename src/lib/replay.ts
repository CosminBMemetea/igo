// Querra Fleet: datele pentru REPLAY-ul unei ture/curse. Demo: ziua camionului pe drumuri reale (roads.json/OSRM).
// Firme reale: pozițiile salvate în tură (pingurile șoferului). Golurile (mod privat / fără semnal) NU au geometrie — doar o legătură punctată.
import { DEMO_DAY, DEMO_NOW_MIN, TRUCKS, dayPlan, kmAt, nearestWaypoint, pointAtKm, haversineKm, pathBetween, routeTotalKm, type LatLng } from "./fleet/data";
import { TRIPS } from "./fleet/seed";
import type { PosRow, FuelTxRow } from "./store/types";

export type RKind = "start" | "fuel" | "pause" | "private" | "end";
export interface ReplayEvent { kind: RKind; min: number; end?: number; km: number; place?: string; litres?: number; day?: boolean }
export interface ReplayData {
  vehicleId: string; plate: string; driver: string; route: string; date: string; tripId: string | null; demo: boolean;
  /** puncte [lat, lng, km] — km cumulați pe tură */
  path: [number, number, number][];
  /** cadre-cheie [minut, km], liniare pe porțiuni (clientul le netezește) */
  keys: [number, number][];
  events: ReplayEvent[]; start: number; end: number; rate: number; km: number;
}
const near = (p: LatLng, q: LatLng) => haversineKm(p, q);

export function demoReplay(vehicleId: string, date: string, tripId: string | null): ReplayData | null {
  const base = TRUCKS.find((x) => x.id === vehicleId);
  if (!base) return null;
  const trip = TRIPS.find((x) => x.id === tripId);
  const reverseRoute = trip?.title === base.routeName.split(" → ").reverse().join(" → ");
  const t = { ...base, reverseRoute, route: reverseRoute ? [...base.route].reverse() : base.route, routeName: trip?.title ?? base.routeName };
  const plan = dayPlan(t), start = t.depMin;
  const arrival = plan.find((p) => p.kind === "stop" && p.kmStart > 0)!.start;
  const end = Math.min(arrival, date === DEMO_DAY ? DEMO_NOW_MIN : arrival), km = kmAt(t, end);
  const phases = plan.filter((p) => p.kind !== "stop" && p.start < end);
  const keys: [number, number][] = [[start, 0]];
  const events: ReplayEvent[] = [{ kind: "start", min: start, km: 0, place: t.route[0].name }];
  for (const p of phases) {
    keys.push([Math.min(p.end, end), Math.min(p.kmEnd, km)]);
    if (p.kind === "pump") events.push({ kind: "fuel", min: p.start, end: Math.min(p.end, end), km: p.kmStart, place: nearestWaypoint(t, pointAtKm(t, p.kmStart)).name, litres: Math.round(((p.kmStart + 360) * t.normalL100) / 100) });
    if (p.kind === "break") events.push({ kind: "pause", min: p.start, end: Math.min(p.end, end), km: p.kmStart });
  }
  // O parte din pauză este privată: nu expunem punctele din acel interval.
  const brk = phases.find((p) => p.kind === "break" && p.start + 6 < end);
  const privateEnd = brk ? Math.min(brk.end + 18, end) : null;
  if (brk && privateEnd != null) events.push({ kind: "private", min: brk.start + 6, end: privateEnd, km: brk.kmStart });
  if (arrival <= end) events.push({ kind: "end", min: end, km, place: t.route[t.route.length - 1].name });
  events.sort((a, b) => a.min - b.min);
  const pts: [number, number, number][] = [];
  const add = (from: number, to: number) => { let k = from, prev: LatLng | null = null; for (const p of pathBetween(t, from, to)) { if (prev) k += near(prev, p); pts.push([p[0], p[1], Math.round(k * 1000) / 1000]); prev = p; } };
  if (brk && privateEnd != null) { add(0, brk.kmStart); if (privateEnd < end) add(kmAt(t, privateEnd), km); }
  else add(0, km);
  return { vehicleId, plate: t.plate, driver: t.driver, route: t.routeName, date, tripId, demo: true, path: pts, keys, events, start, end, rate: t.normalL100, km: Math.round(km) };
}

/** Firmă reală: pozițiile din ziua respectivă. Gol > 15 min = privat / fără semnal (nu inventăm traseu). */
export function firmReplay(o: { vehicleId: string; plate: string; driver: string; date: string; tripId: string | null; rate: number; pos: PosRow[]; fuel: FuelTxRow[] }): ReplayData | null {
  const day = o.pos.filter((p) => p.truckId === o.vehicleId && p.at.slice(0, 10) === o.date).sort((a, b) => a.at.localeCompare(b.at));
  if (day.length < 2) return null;
  const min = (iso: string) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16) + (+iso.slice(17, 19) || 0) / 60;
  const path: [number, number, number][] = [], keys: [number, number][] = [], events: ReplayEvent[] = [];
  let km = 0;
  for (let i = 0; i < day.length; i++) {
    const p = day[i], m = min(p.at);
    if (i) {
      const q = day[i - 1], gap = m - min(q.at);
      if (gap > 15) events.push({ kind: "private", min: min(q.at), end: m, km });
      else km += near([q.lat, q.lng], [p.lat, p.lng]);
    }
    path.push([p.lat, p.lng, Math.round(km * 1000) / 1000]); keys.push([m, km]);
  }
  // opriri ≥ 10 min fără deplasare = pauze
  for (let i = 1; i < keys.length; i++) {
    let j = i; while (j + 1 < keys.length && keys[j + 1][1] - keys[i][1] < 0.15 && keys[j + 1][0] - keys[j][0] <= 15) j++;
    if (j > i && keys[j][0] - keys[i][0] >= 10) { events.push({ kind: "pause", min: keys[i][0], end: keys[j][0], km: keys[i][1] }); i = j; }
  }
  for (const f of o.fuel) if (f.truckId === o.vehicleId && f.at.slice(0, 10) === o.date) {
    const m = min(f.at); const k = keys.reduce((b, x) => (Math.abs(x[0] - m) < Math.abs(b[0] - m) ? x : b), keys[0]);
    events.push({ kind: "fuel", min: m, end: m + 15, km: k[1], place: f.station, litres: f.litres });
  }
  const start = keys[0][0], end = keys[keys.length - 1][0];
  events.push({ kind: "start", min: start, km: 0 }, { kind: "end", min: end, km });
  events.sort((a, b) => a.min - b.min);
  return { vehicleId: o.vehicleId, plate: o.plate, driver: o.driver, route: "", date: o.date, tripId: o.tripId, demo: false, path, keys, events, start, end, rate: o.rate, km: Math.round(km) };
}
