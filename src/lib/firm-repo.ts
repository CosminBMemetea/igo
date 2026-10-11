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
const toR = (x: FuelTxRow) => ({ id: x.id, truckId: x.truckId, at: x.at, litres: x.litres, odometer: x.odometer, station: x.station, card: x.card, lat: x.lat, lng: x.lng });
export const truckToVehicle = (t: TruckRow, baseline = t.normalL100 ?? DEFAULT_L100): Vehicle => ({ id: t.id, name: t.plate, kind: "truck", model: t.model ?? "", driver: "", baselineRate: baseline, per100: true, tankL: t.tankL ?? 0 });
export function tripRowToTrip(r: TripRow, tx: FuelTxRow[] = []): Trip {
  let litres = r.litres, fuelPrice = r.fuelPrice;
  // litri estimați → înlocuiți cu alimentările reale ale camionului din ziua cursei (CSV card / bon șofer)
  if (r.litresSource === "estimate") {
    const day = tx.filter((x) => x.truckId === r.truckId && x.at.slice(0, 10) === r.date);
    const L = day.reduce((s, x) => s + x.litres, 0), lei = day.reduce((s, x) => s + (x.amount ?? 0), 0);
    if (L > 0) { litres = r1(L); if (lei > 0 && day.every((x) => x.amount != null)) fuelPrice = Math.round((lei / L) * 100) / 100; }
  }
  return {
    id: r.id, vehicleId: r.truckId, clientId: slug(r.client), type: "transport", date: r.date, title: r.title, km: r.km, hours: 0, ha: 0, units: r.km,
    revenue: r.revenue, litres, fuelPrice, tolls: r.tolls, driver: r.driverCost, other: r.other,
    actualRate: r.km ? r1((litres / r.km) * 100) : 0, active: false, payment: "due", invoiceNo: null, tariffNote: "",
  };
}
export class FirmRepository implements IgoRepository {
  constructor(private s: Store, readonly firm: FirmRow) {}
  private txCache?: Promise<FuelTxRow[]>;
  private tx() { return (this.txCache ??= this.s.fuel(this.firm.id)); }
  private since() { return this.firm.createdAt.slice(0, 16); }
  async vehicles() { const [ts, tx] = await Promise.all([this.s.trucks(this.firm.id), this.tx()]); return ts.map((t) => truckToVehicle(t, truckBaseline(t, tx, this.since()).l100)); }
  async trips() { const [rs, tx] = await Promise.all([this.s.trips(this.firm.id), this.tx()]); return rs.map((r) => tripRowToTrip(r, tx)); }
  async clients(): Promise<Client[]> {
    const seen = new Map<string, Client>();
    for (const r of await this.s.trips(this.firm.id)) if (!seen.has(slug(r.client))) seen.set(slug(r.client), { id: slug(r.client), name: r.client, country: "RO", vat: "", contacts: [], payDays: 0 });
    return [...seen.values()];
  }
  async parcels() { return []; }
  async zones() { return []; }
  async docs(): Promise<Doc[]> {
    const [ds, us] = await Promise.all([this.s.docs(this.firm.id), this.s.users(this.firm.id)]);
    return ds.map((d) => (d.userId ? { id: d.id, scope: "driver", ownerId: us.find((u) => u.id === d.userId)?.name ?? "—", userId: d.userId, type: d.type, expires: d.expires, dueKm: d.dueKm ?? null, note: d.note ?? null, fileId: d.fileId ?? null } : { id: d.id, scope: "vehicle", ownerId: d.truckId ?? "", type: d.type, expires: d.expires, dueKm: d.dueKm ?? null, note: d.note ?? null, fileId: d.fileId ?? null }));
  }
  async services() { return []; }
  async fleetData(): Promise<FleetData> { return { trucks: [], fills: [], levels: {} }; }
  async fuelAlerts(): Promise<AppAlert[]> {
    const [ts, tx] = await Promise.all([this.s.trucks(this.firm.id), this.tx()]);
    const since60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 16);
    const pos = await this.s.positions(this.firm.id, since60);
    const rt: RTruck[] = ts.map((t) => ({ id: t.id, plate: t.plate, tankL: t.tankL, normalL100: t.normalL100, baseline: truckBaseline(t, tx, this.since()).kind === "history" ? truckBaseline(t, tx, this.since()).l100 : null }));
    return firmFuelAlerts(rt, tx.map(toR), pos);
  }
  async alerts(): Promise<AppAlert[]> { return sortAlerts([...(await this.fuelAlerts()), ...businessAlerts(await this.vehicles(), await this.trips(), await this.docs(), Date.now())]); }
  async addDriverFill(f: Omit<DriverFill, "id">) {
    const hash = `driver:${newId("h")}`;
    await this.s.addFuel(this.firm.id, [{ truckId: f.vehicleId, source: "driver", importId: null, hash, card: null, plate: null, at: f.time.slice(0, 16), station: f.station, country: null, product: null, litres: f.litres, amount: f.amount, currency: null, odometer: Math.round(f.odometerKm), lat: null, lng: null, userId: null, photoName: f.photo?.name ?? null, photoSize: f.photo?.size ?? null, aiRead: f.aiRead }]);
    this.txCache = undefined;
    return { ...f, id: hash };
  }
  async driverFills(vehicleId?: string): Promise<DriverFill[]> {
    const rows = await this.s.fuel(this.firm.id, { source: "driver", truckId: vehicleId, limit: 50 });
    return rows.reverse().map((x) => ({ id: x.id, vehicleId: x.truckId ?? "", time: x.at, litres: x.litres, odometerKm: x.odometer ?? 0, amount: x.amount, station: x.station, photo: x.photoName ? { name: x.photoName, size: x.photoSize ?? 0 } : null, aiRead: x.aiRead }));
  }
  async setShift(s: Shift) { await this.s.setShift(this.firm.id, { truckId: s.vehicleId, start: s.start, end: s.end, checklist: s.checklist }); return s; }
  async shift(vehicleId: string) { const r = await this.s.shift(this.firm.id, vehicleId); return r ? { vehicleId: r.truckId, start: r.start, end: r.end, checklist: r.checklist } : null; }
}
