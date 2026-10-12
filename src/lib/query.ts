// Querra Fleet: interogări sigure peste date (folosite de pagini, API și asistentul AI). Fără I/O direct.
import { tripProfit, savings, sumSavings, type ProfitBreakdown, type Savings } from "./calc";
import { DEMO_NOW_MIN, TRUCKS, haversineKm, kmAt, pathBetween, roadOf, minToHHMM, positionAt, routeTotalKm, type LatLng } from "./fleet/data";
import { FUEL_PRICE, type Client, type Parcel, type Trip, type Vehicle, type Zone } from "./fleet/seed";

export interface TripView extends Trip { p: ProfitBreakdown; s: Savings; vehicle: Vehicle }
export function tripView(tr: Trip, vehicles: Vehicle[]): TripView {
  const vehicle = vehicles.find((v) => v.id === tr.vehicleId)!;
  return { ...tr, vehicle, p: tripProfit(tr), s: savings(tr.units, vehicle.baselineRate, tr.actualRate, tr.fuelPrice, vehicle.per100) };
}
export const tripViews = (trips: Trip[], vehicles: Vehicle[]) => trips.map((t) => tripView(t, vehicles));

export interface MonthSummary { n: number; profit: number; avgProfit: number; savings: Savings; revenue: number }
/** Luna demo (octombrie 2026): curse/lucrări încheiate. */
export function monthSummary(views: TripView[]): MonthSummary {
  const done = views.filter((v) => !v.active);
  const profit = done.reduce((s, v) => s + v.p.profit, 0);
  return { n: done.length, profit, avgProfit: done.length ? profit / done.length : 0, savings: sumSavings(done.map((v) => v.s)), revenue: done.reduce((s, v) => s + v.revenue, 0) };
}
export function vehicleSummary(v: Vehicle, views: TripView[]) {
  const mine = views.filter((x) => x.vehicleId === v.id);
  const done = mine.filter((x) => !x.active);
  const s = sumSavings(done.map((x) => x.s));
  const units = done.reduce((a, x) => a + x.units, 0);
  const actualRate = units ? (v.per100 ? (s.actualLitres / units) * 100 : s.actualLitres / units) : 0;
  return { trips: mine, n: done.length, profit: done.reduce((a, x) => a + x.p.profit, 0), savings: s, units, actualRate, km: done.reduce((a, x) => a + x.km, 0), ha: done.reduce((a, x) => a + x.ha, 0), hours: done.reduce((a, x) => a + x.hours, 0) };
}
export function clientSummaries(clients: Client[], views: TripView[]) {
  return clients.map((c) => {
    const mine = views.filter((x) => x.clientId === c.id);
    const profit = mine.reduce((a, x) => a + x.p.profit, 0), revenue = mine.reduce((a, x) => a + x.revenue, 0);
    const open = mine.filter((x) => x.payment !== "paid");
    return { client: c, trips: mine, n: mine.length, profit, revenue, margin: revenue ? profit / revenue : 0, toCollect: open.reduce((a, x) => a + x.revenue, 0), overdue: mine.filter((x) => x.payment === "overdue").reduce((a, x) => a + x.revenue, 0), worst: mine.some((x) => x.payment === "overdue") ? "overdue" : open.length ? "due" : "paid" } as const;
  }).sort((a, b) => b.profit - a.profit);
}

// ---------- hartă live ----------
export type LiveStatus = "moving" | "stopped" | "pump" | "working" | "offline" | "private";
/** Demo: un șofer în modul privat (pauză / în afara turei) — fără poziție. */
export const DEMO_PRIVATE = new Set(["bh05qrt"]);
/** GDPR: în modul privat sau în afara turei nu există poziție, traseu sau evenimente — nici în API. */
export const privatize = (x: LiveVehicle): LiveVehicle => ({ ...x, status: "private", speed: 0, at: null, secondsAgo: 0, track: [], ahead: [], done: [], dest: "", left: 0, eta: null, today: 0, events: [] });
export interface LiveVehicle {
  id: string; name: string; kind: Vehicle["kind"]; driver: string; status: LiveStatus; speed: number; at: LatLng | null; secondsAgo: number;
  track: { min: number; at: LatLng }[]; ahead: LatLng[]; done: LatLng[]; dest: string; left: number; leftUnit: "km" | "ha"; eta: string | null;
  today: number; todayUnit: "km" | "h"; rate: number; rateUnit: "L/100km" | "L/ha"; profitToday: number | null; tripId: string | null;
  events: { time: string; kind: "entry" | "exit"; zone: string }[];
}
const STEP = 10;
function zigzag(p: Parcel, frac: number): LatLng {
  const lanes = 8, [a, , c] = [p.poly[0], p.poly[1], p.poly[2]];
  const lat0 = a[0], lat1 = c[0], lng0 = a[1], lng1 = c[1];
  const x = Math.max(0, Math.min(0.9999, frac)) * lanes, lane = Math.floor(x), f = x - lane;
  const lat = lat0 + ((lane + 0.5) / lanes) * (lat1 - lat0);
  return [lat, lane % 2 ? lng1 - f * (lng1 - lng0) : lng0 + f * (lng1 - lng0)];
}
function zoneEvents(track: { min: number; at: LatLng }[], zones: Zone[]) {
  const ev: LiveVehicle["events"] = [];
  for (const z of zones) {
    let inside = haversineKm(track[0].at, z.at) * 1000 <= z.radiusM;
    for (const pt of track.slice(1)) {
      const now = haversineKm(pt.at, z.at) * 1000 <= z.radiusM;
      if (now !== inside) ev.push({ time: minToHHMM(pt.min), kind: now ? "entry" : "exit", zone: z.name });
      inside = now;
    }
  }
  return ev.sort((a, b) => a.time.localeCompare(b.time));
}
export function liveFleet(vehicles: Vehicle[], views: TripView[], parcels: Parcel[], zones: Zone[], now = DEMO_NOW_MIN, priv: Set<string> = DEMO_PRIVATE): LiveVehicle[] {
  return liveFleetRaw(vehicles, views, parcels, zones, now).map((x) => (priv.has(x.id) ? privatize(x) : x));
}
function liveFleetRaw(vehicles: Vehicle[], views: TripView[], parcels: Parcel[], zones: Zone[], now: number): LiveVehicle[] {
  return vehicles.map((v): LiveVehicle => {
    const active = views.find((x) => x.vehicleId === v.id && x.active) ?? null;
    const truck = TRUCKS.find((t) => t.id === v.id);
    const base = { id: v.id, name: v.name, kind: v.kind, driver: v.driver, tripId: active?.id ?? null, profitToday: active ? active.p.profit : null };
    if (truck) {
      const track = [] as { min: number; at: LatLng }[];
      for (let m = 0; m <= now; m += STEP) track.push({ min: m, at: positionAt(truck, m).at });
      const pos = positionAt(truck, now), total = routeTotalKm(truck), km = kmAt(truck, now), half = total / 2;
      const out = km < half, left = Math.max(0, Math.round((out ? half : total) - km));
      const dest = out ? truck.route[truck.route.length - 1].name : truck.route[0].name;
      const ahead = left ? pathBetween(truck, km, out ? half : total) : [];
      return { ...base, status: pos.status, speed: pos.speedKmh, at: pos.at, secondsAgo: pos.status === "moving" ? 12 : 95, track, ahead, done: pathBetween(truck, 0, km), dest, left, leftUnit: "km", eta: left ? minToHHMM(now + (left / 64) * 60) : null, today: Math.round(km), todayUnit: "km", rate: active?.actualRate ?? v.baselineRate, rateUnit: "L/100km", events: zoneEvents(track, zones) };
    }
    if (v.kind === "agri") {
      const parcel = active ? parcels.find((p) => p.id === active.parcelId) : undefined;
      const farm = zones.find((z) => z.id === "ferma")!.at;
      if (!parcel || !active) return { ...base, status: "stopped", speed: 0, at: farm, secondsAgo: 240, track: [{ min: now, at: farm }], ahead: [], done: [], dest: zones.find((z) => z.id === "ferma")!.name, left: 0, leftUnit: "ha", eta: null, today: 0, todayUnit: "h", rate: v.baselineRate, rateUnit: "L/ha", events: [] };
      const start = 8 * 60, haph = active.ha / active.hours, fullHa = parcel.ha;
      const track: { min: number; at: LatLng }[] = [{ min: start - STEP, at: farm }];
      for (let m = start; m <= now; m += STEP) track.push({ min: m, at: zigzag(parcel, (((m - start) / 60) * haph) / fullHa) });
      const doneHa = Math.min(fullHa, ((now - start) / 60) * haph), left = Math.round(fullHa - doneHa);
      return { ...base, status: "working", speed: 7, at: track[track.length - 1].at, secondsAgo: 30, track, ahead: [], done: track.map((p) => p.at), dest: parcel.name, left, leftUnit: "ha", eta: minToHHMM(now + (left / haph) * 60), today: Math.round(((now - start) / 60) * 10) / 10, todayUnit: "h", rate: active.actualRate, rateUnit: "L/ha", events: zoneEvents(track, zones) };
    }
    // utilitară: tur prin Oradea
    // utilitară: tur prin Oradea pe străzi reale (roads.json „van”)
    const loop = roadOf("van") ?? [[47.0465, 21.9189], [47.065, 21.94], [47.07, 21.9], [47.05, 21.88], [47.0465, 21.9189]] as LatLng[];
    const cum = [0]; for (let i = 1; i < loop.length; i++) cum.push(cum[i - 1] + haversineKm(loop[i - 1], loop[i]));
    const L = cum[cum.length - 1];
    const at = (km: number): LatLng => { const k = ((km % L) + L) % L; let i = 1; while (i < cum.length - 1 && cum[i] < k) i++; const f = (k - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), a = loop[i - 1], b = loop[i]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    const track = [] as { min: number; at: LatLng }[];
    for (let m = 7 * 60; m <= now; m += STEP) track.push({ min: m, at: at(((m - 420) / 60) * 24) });
    const kNow = ((now - 420) / 60) * 24, ahead: LatLng[] = [];
    for (let d = 0; d <= 6; d += 0.25) ahead.push(at(kNow + d));
    return { ...base, status: "moving", speed: 38, at: track[track.length - 1].at, secondsAgo: 8, track, ahead, done: track.map((p) => p.at), dest: "Oradea", left: 6, leftUnit: "km", eta: minToHHMM(now + 12), today: 64, todayUnit: "km", rate: v.baselineRate * 0.9, rateUnit: "L/100km", events: zoneEvents(track, zones) };
  });
}
export const FUEL = FUEL_PRICE;

/** Traseul complet (dus-întors) al unui camion demo, pe drumuri reale: pentru detaliul unei curse încheiate. */
export function fullPath(vehicleId: string): LatLng[] {
  const t = TRUCKS.find((x) => x.id === vehicleId);
  return t ? pathBetween(t, 0, routeTotalKm(t)) : [];
}
