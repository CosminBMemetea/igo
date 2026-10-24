// Querra Fleet: clasamentul șoferilor și compararea camioanelor după consum.
// Scor 0–100 din: consum față de normă, frânări/accelerări bruște, viteză, mers în gol, livrări la timp, alerte.
// Demo: un rând pe camion (șofer fix). Firmele reale: un rând pe ȘOFER, din cursele finalizate atribuite lui (camionul poate varia; afișăm
// camionul cel mai folosit): consum + alerte + (cu destui km) depășirile limitei setate, din GPS-ul telefonului → ponderile se renormalizează.
import { mulberry32 } from "./fleet/data";
import type { Vehicle } from "./fleet/seed";
import type { TripView } from "./query";
import { bucharestDay, completedDay } from "./trip-stage";
import type { SpeedPart } from "./speed";

export type Comp = "cons" | "harsh" | "speed" | "idle" | "ontime" | "alerts";
const W: Record<Comp, number> = { cons: 35, harsh: 20, speed: 15, idle: 10, ontime: 10, alerts: 10 };
export interface DriverRank {
  id: string; driver: string; plate: string; /** demo: the row's truck; real firms: the driver's most-used truck */ truckId: string; score: number; l100: number | null; base: number; vsBase: number | null;
  harsh: number | null; speeding: number | null; idle: number | null; onTime: number | null; alerts: number; km: number;
  /** Real firms: set-limit warnings per 100 km (phone GPS), only with enough km on finished trips. */ speedPer100?: number | null;
  parts: Partial<Record<Comp, number>>; worst: Comp | null; best: Comp | null;
}
export interface TruckCmp { id: string; plate: string; model: string; l100: number | null; base: number; vsFleet: number | null; trend: number | null; km: number }
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
/** valori demo deterministe (telematică simulată); câțiva șoferi intenționat slabi / foarte buni */
function demoTele(id: string) {
  const r = mulberry32(hash(id));
  const star = id === "bh88qrt" || id === "bh21qrt" || id === "cj90qrt";
  const k = star ? 0.45 : 1;
  const t = { harsh: Math.round((0.6 + r() * 1.4) * k * 10) / 10, speeding: Math.round((1 + r() * 3.5) * k * 10) / 10, idle: Math.round((4 + r() * 7) * (star ? 0.7 : 1) * 10) / 10, onTime: Math.round(Math.min(100, (star ? 97 : 90) + r() * 6)) };
  // profiluri slabe diferite, ca motivele și sfaturile să difere
  if (id === "cj52qrt") { t.harsh = 3.4; t.speeding = 6.1; }
  if (id === "ct14qrt") { t.idle = 17.5; t.onTime = 84; }
  if (id === "cj08qrt") { t.speeding = 8.4; t.idle = 12.2; }
  if (id === "tm33qrt") t.onTime = 81;
  return t;
}
function l100(views: TripView[]) {
  const km = views.reduce((a, v) => a + v.km, 0), L = views.reduce((a, v) => a + (v.km * v.actualRate) / 100, 0);
  return km > 0 ? { l100: Math.round((L / km) * 1000) / 10, km } : { l100: null, km: 0 };
}
export function rankings(vehicles: Vehicle[], views: TripView[], alerts: { vehicleId: string; time?: string }[], today: string, demo: boolean, realSpeed: Record<string, SpeedPart> = {}) {
  const trucks = vehicles.filter((v) => v.kind === "truck" && v.per100);
  const day = (d: string) => Math.round((Date.parse(today) - Date.parse(d)) / 864e5);
  // same finished-trip definition and day as the speed part (completedDay): not planned/in progress, not cancelled
  const done = views.flatMap((v) => { const cd = completedDay(v); return cd && v.km > 0 && day(cd) >= 0 && day(cd) < 30 ? [{ ...v, date: cd }] : []; });
  const per = trucks.map((v) => ({ v, ...l100(done.filter((x) => x.vehicleId === v.id)) }));
  const fleetKm = per.reduce((a, x) => a + x.km, 0), fleetL = per.reduce((a, x) => a + ((x.l100 ?? 0) * x.km) / 100, 0);
  const fleetAvg = fleetKm ? Math.round((fleetL / fleetKm) * 1000) / 10 : null;
  const score = (parts: Partial<Record<Comp, number>>) => { const keys = Object.keys(parts) as Comp[], wsum = keys.reduce((a, k) => a + W[k], 0); return Math.round((keys.reduce((a, k) => a + W[k] * parts[k]!, 0) / (wsum || 1)) * 100); };
  const extremes = (parts: Partial<Record<Comp, number>>) => { const sorted = (Object.keys(parts) as Comp[]).sort((a, b) => parts[a]! - parts[b]!), good = sorted.filter((k) => k !== "alerts"); return { worst: sorted[0] && parts[sorted[0]]! < 0.75 ? sorted[0] : null, best: good[good.length - 1] ?? null }; };
  const consPart = (vsBase: number | null) => vsBase != null ? clamp(0.8 - vsBase * 4) : undefined; // la normă = 80 (ok), −5% → 1, +8% → 0,48 (de ajutor), +20% → 0
  const drivers: DriverRank[] = demo ? per.map(({ v, l100: c, km }) => {
    const tele = demoTele(v.id);
    const nAl = alerts.filter((a) => a.vehicleId === v.id).length;
    const vsBase = c != null ? (c - v.baselineRate) / v.baselineRate : null; // negativ = mai bine ca norma
    const parts: Partial<Record<Comp, number>> = {};
    const cp = consPart(vsBase); if (cp != null) parts.cons = cp;
    parts.harsh = clamp(1 - tele.harsh / 4); parts.speed = clamp(1 - tele.speeding / 10);
    parts.idle = clamp(1 - (tele.idle - 3) / 20); parts.ontime = clamp((tele.onTime - 70) / 30);
    parts.alerts = clamp(1 - nAl / 4);
    return { id: v.id, driver: v.driver || v.name, plate: v.name, truckId: v.id, score: score(parts), l100: c, base: v.baselineRate, vsBase, harsh: tele.harsh, speeding: tele.speeding, idle: tele.idle, onTime: tele.onTime, alerts: nAl, km, speedPer100: null, parts, ...extremes(parts) };
  }).filter((x) => x.km > 0).sort((a, b) => b.score - a.score) : realDrivers(trucks, done, alerts, realSpeed, score, extremes, consPart);
  const trucksCmp: TruckCmp[] = per.filter((x) => x.l100 != null).map(({ v, l100: c, km }) => {
    const mine = done.filter((x) => x.vehicleId === v.id), a = l100(mine.filter((x) => day(x.date) <= 7)), b = l100(mine.filter((x) => day(x.date) > 7 && day(x.date) <= 14));
    return { id: v.id, plate: v.name, model: v.model, l100: c, base: v.baselineRate, vsFleet: fleetAvg && c != null ? (c - fleetAvg) / fleetAvg : null, trend: a.l100 != null && b.l100 != null ? Math.round((a.l100 - b.l100) * 10) / 10 : null, km };
  }).sort((a, b) => (b.l100 ?? 0) - (a.l100 ?? 0));
  return { drivers, trucks: trucksCmp, fleetAvg, telematics: demo };
}

const UNKNOWN = "—";
/** Real firms: one row per driver from their finished trips (trucks vary). Trips without a driver id group by the trip's driver name, else "—";
 *  the plate is never used as a name. Fuel alerts count for a driver only on a day they finished a trip with that truck. */
function realDrivers(trucks: Vehicle[], done: (TripView & { date: string })[], alerts: { vehicleId: string; time?: string }[], realSpeed: Record<string, SpeedPart>,
  score: (p: Partial<Record<Comp, number>>) => number, extremes: (p: Partial<Record<Comp, number>>) => { worst: Comp | null; best: Comp | null }, consPart: (v: number | null) => number | undefined): DriverRank[] {
  const byId = new Map(trucks.map((v) => [v.id, v])), groups = new Map<string, (TripView & { date: string })[]>();
  for (const v of done) { if (!byId.has(v.vehicleId)) continue; const k = v.driverId ? `id:${v.driverId}` : v.driverName?.trim() ? `name:${v.driverName.trim()}` : "none"; groups.set(k, [...(groups.get(k) ?? []), v]); }
  return [...groups].map(([k, ts]): DriverRank => {
    const km = ts.reduce((a, v) => a + v.km, 0), L = ts.reduce((a, v) => a + (v.km * v.actualRate) / 100, 0), base = ts.reduce((a, v) => a + v.km * byId.get(v.vehicleId)!.baselineRate, 0) / km;
    const c = km > 0 ? Math.round((L / km) * 1000) / 10 : null, vsBase = c != null && base > 0 ? (c - base) / base : null;
    const kmBy = new Map<string, number>(); for (const v of ts) kmBy.set(v.vehicleId, (kmBy.get(v.vehicleId) ?? 0) + v.km);
    const truckId = [...kmBy].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    const days = new Set(ts.map((v) => `${v.vehicleId}|${v.date}`));
    const nAl = alerts.filter((a) => a.time && days.has(`${a.vehicleId}|${bucharestDay(a.time)}`)).length;
    const id = k.startsWith("id:") ? k.slice(3) : k, sp = k.startsWith("id:") ? realSpeed[id] : undefined;
    const parts: Partial<Record<Comp, number>> = {}, cp = consPart(vsBase); if (cp != null) parts.cons = cp;
    if (sp && Number.isFinite(sp.part)) parts.speed = clamp(sp.part); // phone-GPS set-limit warnings, only with enough km (speedParts)
    parts.alerts = clamp(1 - nAl / 4);
    const name = ts.find((v) => v.driverName?.trim())?.driverName?.trim() || UNKNOWN;
    return { id, driver: name, plate: byId.get(truckId)!.name, truckId, score: score(parts), l100: c, base: Math.round(base * 10) / 10, vsBase, harsh: null, speeding: null, idle: null, onTime: null, alerts: nAl, km, speedPer100: sp?.per100 ?? null, parts, ...extremes(parts) };
  }).filter((x) => x.km > 0).sort((a, b) => b.score - a.score || a.driver.localeCompare(b.driver));
}

/** Top / Au nevoie de ajutor fără dubluri: același șofer nu apare în ambele; cu sub 3 șoferi nu forțăm un „top”. */
export function splitRank<T extends { id: string; score: number; worst?: unknown }>(drivers: T[], max = 3): { top: T[]; help: T[]; few: boolean } {
  const n = drivers.length, few = n < 3;
  const top = (few ? drivers.filter((x) => x.score >= 75) : drivers.slice(0, Math.min(max, Math.ceil(n / 2)))).slice(0, max);
  const help = drivers.filter((x) => !top.includes(x) && x.worst && x.score < 75).slice(-max).reverse();
  return { top, help, few };
}
