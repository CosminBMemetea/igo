import { localNow } from "./validate";
import { createHash } from "node:crypto";
// Querra Fleet: depozitul unei firme reale (Postgres sau memorie), adaptat la IgoRepository. Totul filtrat după firmId.
import type { FleetData } from "./fleet/rules";
import type { Client, Doc, Trip, Vehicle } from "./fleet/seed";
import { businessAlerts, sortAlerts, type AppAlert, type DriverFill, type IgoRepository, type Shift } from "./repo";
import { newId, type FirmRow, type FuelTxRow, type Store, type TripRow, type TruckRow } from "./store/types";
import { fillToFill, firmFuelAlerts, type RTruck } from "./fuel/rules";

export const DEFAULT_L100 = 30;
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Baza de consum a camionului: istoricul cardului de dinainte de Querra Fleet (≥ 500 km), altfel consumul normal declarat, altfel 30. */
export function truckBaseline(t: TruckRow, tx: FuelTxRow[], since: string): { l100: number; kind: "history" | "normal" | "default"; km: number } {
  const h = fillToFill(tx.filter((x) => x.truckId === t.id && x.at < since).map(toR));
  if (h.l100) return { l100: h.l100, kind: "history", km: h.km };
  if (t.normalL100) return { l100: t.normalL100, kind: "normal", km: 0 };
  return { l100: DEFAULT_L100, kind: "default", km: 0 };
}
const toR = (x: FuelTxRow) => ({ id: x.id, plate: x.source === "driver" ? x.plate : null, truckId: x.truckId, at: x.at, litres: x.litres, odometer: x.odometer, station: x.station, card: x.card, lat: x.lat, lng: x.lng });
export const truckToVehicle = (t: TruckRow, baseline = t.normalL100 ?? DEFAULT_L100): Vehicle => ({ compliance: t.compliance, id: t.id, name: t.plate, kind: "truck", model: t.model ?? "", driver: "", baselineRate: baseline, per100: true, tankL: t.tankL ?? 0, costs: t.costs ?? undefined, costHistory: t.costHistory ?? [], real: true, costsConfigured: !!t.costs || !!t.costHistory?.some((x) => x.month <= localNow().slice(0, 7)), archived: !!t.archivedAt });
export function tripRowToTrip(r: TripRow, tx: FuelTxRow[] = []): Trip {
  // Fuel purchases are inventory, not measured consumption of each trip.
  const { litres, fuelPrice } = r;
  return {
    id: r.id, vehicleId: r.truckId, clientId: slug(r.client), type: "transport", date: r.date, title: r.title, km: r.km, hours: 0, ha: 0, units: r.km,
    revenue: r.revenue, litres, fuelPrice, tolls: r.tolls, driver: r.driverCost, other: r.other,
    actualRate: r.km ? r1((litres / r.km) * 100) : 0, active: !!r.planned, loadedAt: r.loadedAt, deliveredAt: r.deliveredAt, cancelledAt: r.cancelledAt, cancelReason: r.cancelReason, litresSource: r.litresSource ?? "manual", driverId: r.driverId ?? null, planned: !!r.planned, ...(r.tonnes != null ? { tonnes: r.tonnes } : {}), payment: "due", invoiceNo: null, tariffNote: "",
  };
}
export class FirmRepository implements IgoRepository {
  constructor(private s: Store, readonly firm: FirmRow) {}
  private txCache?: Promise<FuelTxRow[]>;
  private tx() { return (this.txCache ??= this.s.fuel(this.firm.id)); }
  // memo per cerere (repo-ul trăiește cât tenant()-ul cererii): layout + pagină + alerte nu repetă aceleași interogări
  private m = new Map<string, Promise<unknown>>();
  private memo<T>(k: string, f: () => Promise<T>): Promise<T> { let p = this.m.get(k) as Promise<T> | undefined; if (!p) { p = f(); this.m.set(k, p); p.catch(() => this.m.delete(k)); } return p; }
  private trucksQ() { return this.memo("trucks", () => this.s.trucks(this.firm.id)); }
  private tripsQ() { return this.memo("trips", () => this.s.trips(this.firm.id)); }
  private since() { return this.firm.createdAt.slice(0, 16); }
  // șoferul camionului = utilizatorul (rol driver) legat de camion; fără nume → partea din fața @ a emailului
  async vehicles() {
    const [ts, tx, us] = await Promise.all([this.trucksQ(), this.tx(), this.memo("users", () => this.s.users(this.firm.id)).catch(() => [])]);
    const nm = (u: { name: string; email: string | null }) => u.name?.trim() || (u.email ? u.email.split("@")[0] : "");
    return ts.map((t) => { const drv = us.filter((x) => x.role === "driver" && !x.disabledAt), u = drv.find((x) => x.truckId === t.id), b = truckBaseline(t, tx, this.since()); return { ...truckToVehicle(t, b.l100), baselineKind: b.kind, driver: u ? nm(u) : "" }; });
  }
  async trips() { const [rs, tx, us] = await Promise.all([this.tripsQ(), this.tx(), this.s.users(this.firm.id)]); const nm = new Map(us.map((u) => [u.id, u.name])); return rs.map((r) => { const t = tripRowToTrip(r, tx), n = r.driverId ? nm.get(r.driverId) : undefined; return n ? { ...t, driverName: n } : t; }); }
  async clients(): Promise<Client[]> {
    const seen = new Map<string, Client>();
    for (const r of await this.tripsQ()) if (!seen.has(slug(r.client))) seen.set(slug(r.client), { id: slug(r.client), name: r.client, country: "RO", vat: "", contacts: [], payDays: 0 });
    return [...seen.values()];
  }
  async parcels() { return []; }
  async zones() { return []; }
  async docs(): Promise<Doc[]> {
    const [ds, us] = await Promise.all([this.s.docs(this.firm.id), this.s.users(this.firm.id)]);
    return ds.map((d) => (d.userId ? { id: d.id, scope: "driver", ownerId: us.find((u) => u.id === d.userId)?.name ?? "—", userId: d.userId, type: d.type, expires: d.expires, validFrom: d.validFrom, dueKm: d.dueKm ?? null, note: d.note ?? null, fileId: d.fileId ?? null } : { id: d.id, scope: "vehicle", ownerId: d.truckId ?? "", type: d.type, expires: d.expires, validFrom: d.validFrom, dueKm: d.dueKm ?? null, note: d.note ?? null, fileId: d.fileId ?? null }));
  }
  async services() { return []; }
  async fleetData(): Promise<FleetData> { return { trucks: [], fills: [], levels: {} }; }
  async fuelAlerts(): Promise<AppAlert[]> {
    const since60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 16);
    const [ts, tx, pos] = await Promise.all([this.trucksQ(), this.tx(), this.s.positions(this.firm.id, since60)]);
    const rt: RTruck[] = ts.map((t) => { const b = truckBaseline(t, tx, this.since()); return { id: t.id, plate: t.plate, tankL: t.tankL, normalL100: t.normalL100, baseline: b.kind === "history" ? b.l100 : null }; });
    return firmFuelAlerts(rt, tx.map(toR), pos);
  }
  async alerts(): Promise<AppAlert[]> {
    return this.memo("alerts", async () => {
      const [fuel, v, tr, d, users] = await Promise.all([this.fuelAlerts(), this.vehicles(), this.trips(), this.docs(), this.memo("users", () => this.s.users(this.firm.id))]);
      const activeDocs = d.filter(doc => doc.scope !== "driver" || users.some(u => u.id === doc.userId && !u.disabledAt));
      return sortAlerts([...fuel, ...businessAlerts(v, tr, activeDocs, Date.now())]);
    });
  }
  async addDriverFill(f: Omit<DriverFill, "id">) {
    const key = f.key ? `${f.userId}:${f.key}` : JSON.stringify([f.vehicleId, f.time.slice(0, 10), f.litres, f.odometerKm, f.amount, f.station]);
    const hash = `driver:${createHash("sha256").update(key).digest("hex")}`;
    const saved = await this.s.addFuel(this.firm.id, [{ truckId: f.vehicleId, source: "driver", importId: null, hash, card: null, plate: f.plate ?? null, at: f.time.slice(0, 16), station: f.station, country: null, product: null, litres: f.litres, amount: f.amount, currency: f.currency ?? null, amountRon: f.amountRon ?? null, fxRate: f.fxRate ?? null, fxDate: f.fxDate ?? null, odometer: Math.round(f.odometerKm), lat: null, lng: null, userId: f.userId ?? null, photoName: f.photo ? (f.photo.fileId ? `file:${f.photo.fileId}` : f.photo.name) : null, photoSize: f.photo?.size ?? null, aiRead: f.aiRead }]);
    this.txCache = undefined; this.m.delete("alerts");
    const row = await this.s.fuelByHash(this.firm.id, hash);
    if (!row) throw new Error("Fuel transaction missing after save");
    return { ...f, id: row.id, duplicate: saved.added === 0, photo: row.photoName?.startsWith("file:") ? { name: row.photoName, size: row.photoSize ?? 0, fileId: row.photoName.slice(5) } : null };
  }
  async driverFills(vehicleId?: string): Promise<DriverFill[]> {
    const rows = await this.s.fuel(this.firm.id, { source: "driver", truckId: vehicleId, limit: 50 });
    return rows.reverse().map((x) => ({ id: x.id, vehicleId: x.truckId ?? "", time: x.at, litres: x.litres, odometerKm: x.odometer ?? 0, amount: x.amount, currency: x.currency, amountRon: x.amountRon, fxRate: x.fxRate, fxDate: x.fxDate, station: x.station, photo: x.photoName ? { name: x.photoName, size: x.photoSize ?? 0, fileId: x.photoName.startsWith("file:") ? x.photoName.slice(5) : null } : null, plate: x.plate, aiRead: x.aiRead }));
  }
  async setShift(s: Shift) { await this.s.setShift(this.firm.id, { truckId: s.vehicleId, start: s.start, end: s.end, checklist: s.checklist, privateSince: s.privateSince ?? null }); return s; }
  async shift(vehicleId: string) { const r = await this.s.shift(this.firm.id, vehicleId); return r ? { vehicleId: r.truckId, start: r.start, end: r.end, checklist: r.checklist, privateSince: r.privateSince ?? null } : null; }
}
