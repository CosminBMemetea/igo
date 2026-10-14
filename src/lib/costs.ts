// Costuri pe camion (fixe lunare + variabile pe km), tonaj / grad de încărcare și profitul real pe cursă.
// Fără I/O: profilurile vin din vehicul (demo: implicite + cookie; firmă reală: coloana trucks.costs).
import type { Trip, Vehicle } from "./fleet/seed";

export const FIXED_KEYS = ["leasing", "rca", "casco", "rovinieta", "salary", "parking"] as const;
export const VAR_KEYS = ["adblue", "tyres", "service"] as const;
export type FixedKey = (typeof FIXED_KEYS)[number];
export type VarKey = (typeof VAR_KEYS)[number];
/** fixe: lei/lună · variabile: lei/km · loadWear: lei per tonă·km (uzură suplimentară din tonaj) · capacityT: tone */
export type CostProfile = Record<FixedKey, number> & Record<VarKey, number> & { loadWear: number; capacityT: number };
export const COST_KEYS = [...FIXED_KEYS, ...VAR_KEYS, "loadWear", "capacityT"] as const;
export type CostKey = (typeof COST_KEYS)[number];
export const COST_MAX: Record<CostKey, number> = { leasing: 100000, rca: 20000, casco: 20000, rovinieta: 5000, salary: 50000, parking: 10000, adblue: 5, tyres: 5, service: 5, loadWear: 1, capacityT: 60 };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const TRUCK: CostProfile = { leasing: 6000, rca: 1100, casco: 750, rovinieta: 480, salary: 5200, parking: 250, adblue: 0.07, tyres: 0.18, service: 0.22, loadWear: 0.006, capacityT: 24 };
const VAN: CostProfile = { leasing: 2900, rca: 650, casco: 380, rovinieta: 60, salary: 4800, parking: 150, adblue: 0.03, tyres: 0.07, service: 0.11, loadWear: 0.02, capacityT: 1.4 };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Valori implicite realiste, ușor diferite pe camion (unele camioane au leasingul achitat). */
export function defaultProfile(v: Pick<Vehicle, "id" | "kind" | "model">): CostProfile {
  const b = v.kind === "van" ? VAN : TRUCK, h = hash(v.id), h2 = hash(v.id + "x");
  const paidOff = v.kind === "truck" && h < 0.22;
  return { ...b, leasing: paidOff ? 0 : Math.round((b.leasing * (0.85 + h2 * 0.35)) / 50) * 50, casco: paidOff ? Math.round(b.casco * 0.6) : b.casco, service: r2(b.service * (paidOff ? 1.45 : 0.9 + h * 0.3)), tyres: r2(b.tyres * (0.9 + h2 * 0.25)), capacityT: v.kind === "truck" && h2 > 0.8 ? 22 : b.capacityT };
}
export const EMPTY_PROFILE: CostProfile = { leasing: 0, rca: 0, casco: 0, rovinieta: 0, salary: 0, parking: 0, adblue: 0, tyres: 0, service: 0, loadWear: 0, capacityT: 0 };
export const profileOf = (v: Vehicle): CostProfile => ({ ...(v.real ? EMPTY_PROFILE : defaultProfile(v)), ...(v.costs ?? {}) });
export const fixedMonthly = (p: CostProfile) => FIXED_KEYS.reduce((a, k) => a + p[k], 0);
export const varPerKm = (p: CostProfile) => VAR_KEYS.reduce((a, k) => a + p[k], 0);
export const hasCosts = (v: Vehicle) => v.kind === "truck" || v.kind === "van";

/** Tonaj demo determinist pe cursă: dus încărcat, unele retururi goale, câțiva km de poziționare. */
export function demoLoad(tr: Trip, v: Vehicle, routeName?: string): { tonnes: number; emptyKm: number } {
  if (tr.tonnes !== undefined) return { tonnes: tr.tonnes, emptyKm: tr.emptyKm ?? 0 };
  const cap = profileOf(v).capacityT, h = hash(tr.id), h2 = hash(tr.id + "t");
  if (tr.id === "tm33qrt-milano") return { tonnes: Math.round(cap * 0.38), emptyKm: 590 };
  const back = routeName && tr.title !== routeName && tr.title === routeName.split(" → ").reverse().join(" → ");
  if (back && h < 0.4) return { tonnes: 0, emptyKm: tr.km };
  const tonnes = Math.round(cap * (back ? 0.35 + h2 * 0.5 : 0.62 + h2 * 0.38) * 10) / 10;
  return { tonnes, emptyKm: Math.round(tr.km * (0.03 + h * 0.13)) };
}

export interface Econ { tonnes: number | null; emptyKm: number; loadPct: number | null; capacityT: number; fuel: number; tolls: number; driver: number; adblue: number; tyres: number; service: number; loadWear: number; fixed: number; fixedPerKm: number; costs: number; profit: number; margin: number; costPerKm: number; costPerT: number | null }
/** Profit real = Preț cursă − motorină − taxe drum − șofer (diurnă) − AdBlue − anvelope − service − uzură din tonaj − cota de costuri fixe (pe km). */
export function tripEcon(tr: Trip, v: Vehicle, kmMonth: number, ld: { tonnes: number | null; emptyKm: number }): Econ {
  const p = profileOf(v), km = tr.km, loadedKm = Math.max(0, km - ld.emptyKm);
  const fuel = r2(tr.litres * tr.fuelPrice), fixedPerKm = kmMonth > 0 ? fixedMonthly(p) / kmMonth : 0;
  const adblue = r2(km * p.adblue), tyres = r2(km * p.tyres), service = r2(km * p.service), loadWear = r2((ld.tonnes ?? 0) * loadedKm * p.loadWear), fixed = r2(km * fixedPerKm);
  const costs = r2(fuel + tr.tolls + tr.driver + tr.other + adblue + tyres + service + loadWear + fixed), profit = r2(tr.revenue - costs);
  const loadPct = ld.tonnes === null || !km || !p.capacityT ? null : (ld.tonnes / p.capacityT) * (loadedKm / km);
  return { tonnes: ld.tonnes, emptyKm: ld.emptyKm, loadPct, capacityT: p.capacityT, fuel, tolls: tr.tolls, driver: tr.driver, adblue, tyres, service, loadWear, fixed, fixedPerKm, costs, profit, margin: tr.revenue ? profit / tr.revenue : 0, costPerKm: km ? costs / km : 0, costPerT: ld.tonnes ? costs / ld.tonnes : null };
}
/** km pe lună per vehicul (din perioada acoperită de curse) — baza pentru cota de costuri fixe. */
export function kmPerMonth(trips: Trip[]): Map<string, number> {
  const ds = trips.map((t) => Date.parse(t.date)).filter(Number.isFinite);
  const span = ds.length ? Math.max(7, Math.round((Math.max(...ds) - Math.min(...ds)) / 86400000) + 1) : 30;
  const m = new Map<string, number>();
  for (const t of trips) m.set(t.vehicleId, (m.get(t.vehicleId) ?? 0) + t.km);
  for (const [k, km] of m) m.set(k, Math.max(1500, (km * 30) / span));
  return m;
}
