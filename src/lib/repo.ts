// Querra Fleet: stratul de date. Paginile și API-urile citesc DOAR prin IgoRepository,
// ca o implementare Postgres (Neon, Frankfurt) să înlocuiască demo-ul fără alte schimbări.
import { FILLS, TRUCKS, levelSeries, type LevelPoint } from "./fleet/data";
import { computeAlerts, type FleetData, type RuleId, type Severity } from "./fleet/rules";
import { CLIENTS, DOCS, PARCELS, SERVICES, TRIPS, VEHICLES, ZONES, type Client, type Doc, type Parcel, type Service, type Trip, type Vehicle, type Zone } from "./fleet/seed";
import { tripProfit } from "./calc";

export type AlertRule = RuleId | "loss" | "agri-over" | "doc-expiry";
export interface AppAlert { id: string; rule: AlertRule; vehicleId: string; time: string; severity: Severity; theft: boolean; params: Record<string, string | number> }
export interface DriverFill { id: string; vehicleId: string; time: string; litres: number; odometerKm: number; amount: number | null; station: string; photo: { name: string; size: number } | null; aiRead: boolean }
export interface Shift { vehicleId: string; start: string; end: string | null; checklist: string[] }

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

export class DemoRepository implements IgoRepository {
  private fills: DriverFill[] = [];
  private shifts = new Map<string, Shift>();
  async vehicles() { return VEHICLES; }
  async trips() { return TRIPS; }
  async clients() { return CLIENTS; }
  async parcels() { return PARCELS; }
  async zones() { return ZONES; }
  async docs() { return DOCS; }
  async services() { return SERVICES; }
  async fleetData(): Promise<FleetData> {
    const levels: Record<string, LevelPoint[] | null> = {};
    for (const t of TRUCKS) levels[t.id] = levelSeries(t);
    return { trucks: TRUCKS, fills: FILLS, levels };
  }
  async alerts(): Promise<AppAlert[]> {
    const fuel = computeAlerts(await this.fleetData()).map((a): AppAlert => ({ id: a.id, rule: a.rule, vehicleId: a.truckId, time: a.time, severity: a.severity, theft: a.theft, params: a.params }));
    const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    return [...fuel, ...businessAlerts(VEHICLES, TRIPS, DOCS)].sort((a, b) => rank[a.severity] - rank[b.severity] || Number(b.theft) - Number(a.theft) || b.time.localeCompare(a.time));
  }
  async addDriverFill(f: Omit<DriverFill, "id">) {
    const row = { ...f, id: `df-${Date.now()}-${this.fills.length}` };
    this.fills.push(row);
    return row;
  }
  async driverFills(vehicleId?: string) { return this.fills.filter((f) => !vehicleId || f.vehicleId === vehicleId).slice(-20); }
  async setShift(s: Shift) { this.shifts.set(s.vehicleId, s); return s; }
  async shift(vehicleId: string) { return this.shifts.get(vehicleId) ?? null; }
}

export const sortAlerts = (a: AppAlert[]) => { const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }; return a.sort((a, b) => rank[a.severity] - rank[b.severity] || Number(b.theft) - Number(a.theft) || b.time.localeCompare(a.time)); };
// Firma demo: un singur depozit per proces, doar citire (șoferul poate trimite bonuri de test: sandbox în memorie).
const g = globalThis as unknown as { __igoRepo?: IgoRepository };
export function demoRepo(): IgoRepository {
  if (!g.__igoRepo) g.__igoRepo = new DemoRepository();
  return g.__igoRepo;
}
