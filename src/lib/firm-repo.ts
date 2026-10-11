// iGo: depozitul unei firme reale (Postgres sau memorie), adaptat la IgoRepository. Totul filtrat după firmId.
import type { FleetData } from "./fleet/rules";
import type { Client, Doc, Trip, Vehicle } from "./fleet/seed";
import { businessAlerts, sortAlerts, type AppAlert, type DriverFill, type IgoRepository, type Shift } from "./repo";
import type { FirmRow, Store, TripRow, TruckRow } from "./store/types";

export const DEFAULT_L100 = 30;
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
export const truckToVehicle = (t: TruckRow): Vehicle => ({ id: t.id, name: t.plate, kind: "truck", model: t.model ?? "", driver: "", baselineRate: t.normalL100 ?? DEFAULT_L100, per100: true, tankL: t.tankL ?? 0 });
export const tripRowToTrip = (r: TripRow): Trip => ({
  id: r.id, vehicleId: r.truckId, clientId: slug(r.client), type: "transport", date: r.date, title: r.title, km: r.km, hours: 0, ha: 0, units: r.km,
  revenue: r.revenue, litres: r.litres, fuelPrice: r.fuelPrice, tolls: r.tolls, driver: r.driverCost, other: r.other,
  actualRate: r.km ? Math.round((r.litres / r.km) * 1000) / 10 : 0, active: false, payment: "due", invoiceNo: null, tariffNote: "",
});
// bonuri/ture trimise de șofer: încă în memorie (importul real vine cu pasul „card carburant”)
const mem = globalThis as unknown as { __igoFirmFills?: Map<string, DriverFill[]>; __igoFirmShifts?: Map<string, Shift> };
export class FirmRepository implements IgoRepository {
  constructor(private s: Store, readonly firm: FirmRow) {}
  async vehicles() { return (await this.s.trucks(this.firm.id)).map(truckToVehicle); }
  async trips() { return (await this.s.trips(this.firm.id)).map(tripRowToTrip); }
  async clients(): Promise<Client[]> {
    const seen = new Map<string, Client>();
    for (const r of await this.s.trips(this.firm.id)) if (!seen.has(slug(r.client))) seen.set(slug(r.client), { id: slug(r.client), name: r.client, country: "RO", vat: "", contacts: [], payDays: 0 });
    return [...seen.values()];
  }
  async parcels() { return []; }
  async zones() { return []; }
  async docs(): Promise<Doc[]> { return (await this.s.docs(this.firm.id)).map((d) => ({ id: d.id, scope: "vehicle", ownerId: d.truckId, type: d.type, expires: d.expires })); }
  async services() { return []; }
  async fleetData(): Promise<FleetData> { return { trucks: [], fills: [], levels: {} }; }
  async alerts(): Promise<AppAlert[]> { return sortAlerts(businessAlerts(await this.vehicles(), await this.trips(), await this.docs(), Date.now())); }
  private get fills() { mem.__igoFirmFills ??= new Map(); if (!mem.__igoFirmFills.has(this.firm.id)) mem.__igoFirmFills.set(this.firm.id, []); return mem.__igoFirmFills.get(this.firm.id)!; }
  async addDriverFill(f: Omit<DriverFill, "id">) { const row = { ...f, id: `df-${Date.now()}-${this.fills.length}` }; this.fills.push(row); return row; }
  async driverFills(vehicleId?: string) { return this.fills.filter((f) => !vehicleId || f.vehicleId === vehicleId).slice(-20); }
  async setShift(s: Shift) { mem.__igoFirmShifts ??= new Map(); mem.__igoFirmShifts.set(`${this.firm.id}:${s.vehicleId}`, s); return s; }
  async shift(vehicleId: string) { return mem.__igoFirmShifts?.get(`${this.firm.id}:${vehicleId}`) ?? null; }
}
