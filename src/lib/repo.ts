// Querra Fleet: stratul de date. Paginile și API-urile citesc DOAR prin IgoRepository,
// ca o implementare Postgres (Neon, Frankfurt) să înlocuiască demo-ul fără alte schimbări.
import { FILLS, TRUCKS, levelSeries, type LevelPoint } from "./fleet/data";
import { computeAlerts, type FleetData, type RuleId, type Severity } from "./fleet/rules";
import { CLIENTS, DOCS, PARCELS, SERVICES, TRIPS, VEHICLES, ZONES, type Client, type Doc, type Parcel, type Service, type Trip, type Vehicle, type Zone } from "./fleet/seed";
import { tripProfit } from "./calc";
import { byDelta, realToday, shiftDeep } from "./demo-time";

export type AlertRule = RuleId | "loss" | "agri-over" | "doc-expiry" | "gps-privat";
export interface AppAlert { id: string; rule: AlertRule; vehicleId: string; time: string; severity: Severity; theft: boolean; params: Record<string, string | number> }
export interface DriverFill { id: string; vehicleId: string; time: string; litres: number; odometerKm: number; amount: number | null; station: string; photo: { name: string; size: number } | null; aiRead: boolean }
export interface Shift { vehicleId: string; start: string; end: string | null; checklist: string[]; privateSince?: string | null }

export interface IgoRepository {
  vehicles(): Promise<Vehicle[]>;
  trips(): Promise<Trip[]>;
  clients(): Promise<Client[]>;
  parcels(): Promise<Parcel[]>;
  zones(): Promise<Zone[]>;
  docs(): Promise<Doc[]>;
  services(): Promise<Service[]>;
  fleetData(): Promise<FleetData>;
  alerts(): Promise<AppAlert[]>;
  addDriverFill(f: Omit<DriverFill, "id">): Promise<DriverFill>;
  driverFills(vehicleId?: string): Promise<DriverFill[]>;
  setShift(s: Shift): Promise<Shift>;
  shift(vehicleId: string): Promise<Shift | null>;
}

const DOC_WINDOW_DAYS = 30, AGRI_OVER = 0.05;
const DEMO_DATE = Date.UTC(2026, 9, 15);
export function businessAlerts(vehicles: Vehicle[], trips: Trip[], docs: Doc[], now = DEMO_DATE): AppAlert[] {
  const out: AppAlert[] = [];
  for (const tr of trips) {
    const v = vehicles.find((x) => x.id === tr.vehicleId)!;
    const p = tripProfit(tr);
    if (!tr.active && p.profit < 0) {
      const top = ([["tolls", p.tolls], ["other", p.other], ["fuel", p.fuel], ["driver", p.driver]] as const).reduce((a, b) => (b[1] > a[1] ? b : a));
      out.push({ id: `loss-${tr.id}`, rule: "loss", vehicleId: v.id, time: `${tr.date}T18:00`, severity: "high", theft: false, params: { title: tr.title, plate: v.name, date: tr.date, revenue: p.revenue, costs: p.costs, profit: p.profit, top: top[0] } });
    }
    if (v.kind === "agri" && tr.actualRate > v.baselineRate * (1 + AGRI_OVER))
      out.push({ id: `agri-${tr.id}`, rule: "agri-over", vehicleId: v.id, time: `${tr.date}T18:00`, severity: "medium", theft: false, params: { plate: v.name, parcel: tr.title, lha: tr.actualRate, base: v.baselineRate, pct: Math.round((tr.actualRate / v.baselineRate - 1) * 100) } });
  }
  for (const d of docs) {
    if (!d.expires) continue;
    const days = Math.round((Date.parse(d.expires) - now) / 86400000);
    if (days <= DOC_WINDOW_DAYS) {
      const v = vehicles.find((x) => x.id === d.ownerId);
      out.push({ id: `doc-${d.id}`, rule: "doc-expiry", vehicleId: v?.id ?? "", time: `${d.expires}T00:00`, severity: days <= 7 ? "high" : "medium", theft: false, params: { doc: d.type, owner: v?.name ?? d.ownerId, date: d.expires, days } });
    }
  }
  return out;
}

// Demo axat pe camioane: utilajele agricole și utilitarele rămân în cod, dar nu apar în demo.
const TV = VEHICLES.filter((v) => v.kind === "truck");
const TIDS = new Set(TV.map((v) => v.id));
const TT = TRIPS.filter((t) => TIDS.has(t.vehicleId));
const TC = CLIENTS.filter((c) => TT.some((t) => t.clientId === c.id));
const OTHER_DRIVERS = new Set(VEHICLES.filter((v) => !TIDS.has(v.id)).map((v) => v.driver));
const TD = DOCS.filter((d) => (d.scope === "vehicle" ? TIDS.has(d.ownerId) : d.scope === "trip" ? TT.some((t) => t.id === d.ownerId) : !OTHER_DRIVERS.has(d.ownerId)));
const TS = SERVICES.filter((s) => TIDS.has(s.vehicleId));
// datele demo mutate pe azi (o dată pe zi): fără curse sau notificări „din viitor”
const SH = byDelta((d) => ({ TT: shiftDeep(TT, d), TRIPS: shiftDeep(TRIPS, d), TD: shiftDeep(TD, d), DOCS: shiftDeep(DOCS, d), FILLS: shiftDeep(FILLS, d) }));
/** Demo: doar 3 alerte, credibile — o alimentare suspectă, un document care expiră, un consum peste normal. */
export const DEMO_ALERT_PICK: ((a: AppAlert) => boolean)[] = [
  (a) => a.rule === "card-fara-camion",
  (a) => a.rule === "doc-expiry" && a.vehicleId === "bh21qrt",
  (a) => a.rule === "consum-peste-normal",
];
export class DemoRepository implements IgoRepository {
  constructor(private trucksOnly = true) {}
  private fills: DriverFill[] = [];
  private shifts = new Map<string, Shift>();
  async vehicles() { return this.trucksOnly ? TV : VEHICLES; }
  async trips() { const s = SH(); return this.trucksOnly ? s.TT : s.TRIPS; }
  async clients() { return this.trucksOnly ? TC : CLIENTS; }
  async parcels() { return this.trucksOnly ? [] : PARCELS; }
  async zones() { return ZONES; }
  async docs() { const s = SH(); return this.trucksOnly ? s.TD : s.DOCS; }
  async services() { return this.trucksOnly ? TS : SERVICES; }
  async fleetData(): Promise<FleetData> {
    const levels: Record<string, LevelPoint[] | null> = {};
    for (const t of TRUCKS) levels[t.id] = levelSeries(t);
    return { trucks: TRUCKS, fills: SH().FILLS, levels };
  }
  private alertsMemo?: Promise<AppAlert[]>;
  // datele demo sunt statice: alertele se calculează o singură dată per instanță (proces)
  private shifted = byDelta((d) => (this.alertsMemo ??= this.alertsRaw()).then((a) => shiftDeep(this.trucksOnly ? DEMO_ALERT_PICK.map((f) => a.find(f)).filter((x): x is AppAlert => !!x) : a, d)));
  alerts(): Promise<AppAlert[]> { return this.shifted().then((a) => a.slice()); }
  private async alertsRaw(): Promise<AppAlert[]> {
    const levels: Record<string, LevelPoint[] | null> = {};
    for (const t of TRUCKS) levels[t.id] = levelSeries(t);
    const fuel = computeAlerts({ trucks: TRUCKS, fills: FILLS, levels }).map((a): AppAlert => ({ id: a.id, rule: a.rule, vehicleId: a.truckId, time: a.time, severity: a.severity, theft: a.theft, params: a.params }));
    const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    // demo: BH 77 QRT alimentează în pauza privată a șoferului → fără poziție, fără alarmă falsă
    const priv: AppAlert = { id: "gps-privat-bh77", rule: "gps-privat", vehicleId: "bh77qrt", time: "2026-10-15T12:40", severity: "low", theft: false, params: { plate: "BH 77 QRT", station: "MOL Debrecen", litres: 210, time: "2026-10-15T12:40", nogps: 1 } };
    return [...fuel, priv, ...businessAlerts(await this.vehicles(), this.trucksOnly ? TT : TRIPS, this.trucksOnly ? TD : DOCS)].sort((a, b) => rank[a.severity] - rank[b.severity] || Number(b.theft) - Number(a.theft) || b.time.localeCompare(a.time));
  }
  async addDriverFill(f: Omit<DriverFill, "id">) {
    const row = { ...f, id: `df-${Date.now()}-${this.fills.length}` };
    this.fills.push(row);
    return row;
  }
  async driverFills(vehicleId?: string) { return this.fills.filter((f) => !vehicleId || f.vehicleId === vehicleId).slice(-20); }
  async setShift(s: Shift) { this.shifts.set(s.vehicleId, s); return s; }
  // demo: șoferii cu cursă azi sunt deja în tură (pornită la 05:30), ca evenimentele cursei să fie coerente;
  // BH 77 QRT e în pauză privată (apare „Privat” pe hartă) — fără evenimente de cursă în paralel
  async shift(vehicleId: string) {
    const s = this.shifts.get(vehicleId);
    if (s) return s;
    if (!TIDS.has(vehicleId)) return null;
    const day = realToday();
    return { vehicleId, start: `${day}T05:30`, end: null, checklist: ["tyres", "fluids", "docs", "damage"], privateSince: vehicleId === "bh77qrt" ? `${day}T12:30` : null };
  }
}

export const sortAlerts = (a: AppAlert[]) => { const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }; return a.sort((a, b) => rank[a.severity] - rank[b.severity] || Number(b.theft) - Number(a.theft) || b.time.localeCompare(a.time)); };
// Firma demo: un singur depozit per proces, doar citire (șoferul poate trimite bonuri de test: sandbox în memorie).
const g = globalThis as unknown as { __igoRepo?: IgoRepository };
export function demoRepo(): IgoRepository {
  if (!g.__igoRepo) g.__igoRepo = new DemoRepository();
  return g.__igoRepo;
}
