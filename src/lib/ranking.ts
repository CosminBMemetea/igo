// Querra Fleet: clasamentul șoferilor și compararea camioanelor după consum.
// Scor 0–100 din: consum față de normă, frânări/accelerări bruște, viteză, mers în gol, livrări la timp, alerte.
// Firmele reale au deocamdată doar consum + alerte (fără telematică) → ponderile se renormalizează pe ce există.
import { mulberry32 } from "./fleet/data";
import type { Vehicle } from "./fleet/seed";
import type { TripView } from "./query";

export type Comp = "cons" | "harsh" | "speed" | "idle" | "ontime" | "alerts";
const W: Record<Comp, number> = { cons: 35, harsh: 20, speed: 15, idle: 10, ontime: 10, alerts: 10 };
export interface DriverRank {
  id: string; driver: string; plate: string; score: number; l100: number | null; base: number; vsBase: number | null;
  harsh: number | null; speeding: number | null; idle: number | null; onTime: number | null; alerts: number; km: number;
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
export function rankings(vehicles: Vehicle[], views: TripView[], alerts: { vehicleId: string }[], today: string, demo: boolean) {
  const trucks = vehicles.filter((v) => v.kind === "truck" && v.per100);
  const day = (d: string) => Math.round((Date.parse(today) - Date.parse(d)) / 864e5);
  const done = views.filter((v) => !v.active && v.km > 0 && day(v.date) <= 30);
  const per = trucks.map((v) => ({ v, ...l100(done.filter((x) => x.vehicleId === v.id)) }));
  const fleetKm = per.reduce((a, x) => a + x.km, 0), fleetL = per.reduce((a, x) => a + ((x.l100 ?? 0) * x.km) / 100, 0);
  const fleetAvg = fleetKm ? Math.round((fleetL / fleetKm) * 1000) / 10 : null;
  const drivers: DriverRank[] = per.map(({ v, l100: c, km }) => {
    const tele = demo ? demoTele(v.id) : { harsh: null, speeding: null, idle: null, onTime: null };
    const nAl = alerts.filter((a) => a.vehicleId === v.id).length;
    const vsBase = c != null ? (c - v.baselineRate) / v.baselineRate : null; // negativ = mai bine ca norma
    const parts: Partial<Record<Comp, number>> = {};
    if (vsBase != null) parts.cons = clamp(0.5 - vsBase * 3); // −16% → 1, +16% → 0
    if (tele.harsh != null) parts.harsh = clamp(1 - tele.harsh / 4);
    if (tele.speeding != null) parts.speed = clamp(1 - tele.speeding / 10);
    if (tele.idle != null) parts.idle = clamp(1 - (tele.idle - 3) / 20);
    if (tele.onTime != null) parts.ontime = clamp((tele.onTime - 70) / 30);
    parts.alerts = clamp(1 - nAl / 4);
    const keys = Object.keys(parts) as Comp[], wsum = keys.reduce((a, k) => a + W[k], 0);
    const score = Math.round((keys.reduce((a, k) => a + W[k] * parts[k]!, 0) / (wsum || 1)) * 100);
    const sorted = [...keys].sort((a, b) => parts[a]! - parts[b]!), good = sorted.filter((k) => k !== "alerts");
    return { id: v.id, driver: v.driver || "—", plate: v.name, score, l100: c, base: v.baselineRate, vsBase, harsh: tele.harsh, speeding: tele.speeding, idle: tele.idle, onTime: tele.onTime, alerts: nAl, km, parts, worst: sorted[0] && parts[sorted[0]]! < 0.75 ? sorted[0] : null, best: good[good.length - 1] ?? null };
  }).filter((x) => x.km > 0).sort((a, b) => b.score - a.score);
  const trucksCmp: TruckCmp[] = per.filter((x) => x.l100 != null).map(({ v, l100: c, km }) => {
    const mine = done.filter((x) => x.vehicleId === v.id), a = l100(mine.filter((x) => day(x.date) <= 7)), b = l100(mine.filter((x) => day(x.date) > 7 && day(x.date) <= 14));
    return { id: v.id, plate: v.name, model: v.model, l100: c, base: v.baselineRate, vsFleet: fleetAvg && c != null ? (c - fleetAvg) / fleetAvg : null, trend: a.l100 != null && b.l100 != null ? Math.round((a.l100 - b.l100) * 10) / 10 : null, km };
  }).sort((a, b) => (b.l100 ?? 0) - (a.l100 ?? 0));
  return { drivers, trucks: trucksCmp, fleetAvg, telematics: demo };
}
