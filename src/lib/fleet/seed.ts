// Querra Fleet: DATE DEMO (inventate, deterministe). Nu provin de la vehicule sau clienți reali.
import { roIso } from "../demo-time";
import { DEMO_DAY, TRUCKS, mulberry32, routeTotalKm, dayPlan, minToHHMM, DEMO_NOW_MIN, type LatLng } from "./data";

export type VehicleKind = "truck" | "agri" | "van";
export type JobType = "transport" | "harvest" | "plough" | "seed";
export interface Vehicle {
  id: string; name: string; kind: VehicleKind; model: string; driver: string;
  /** km → L/100km (per100); agri → L/ha */
  baselineRate: number; per100: boolean; tankL: number;
  baselineKind?: "history" | "normal" | "default";
  /** L/h pentru utilaje (informativ) */
  lph?: number; engineHours?: number;
  /** costuri editate de patron (suprascriu valorile implicite) */
  costHistory?: import("../costs").CostVersion[];
  costs?: Partial<import("../costs").CostProfile>;
  real?: boolean;
  costsConfigured?: boolean;
  /** scos din flotă: istoric păstrat, exclus din calcule */
  archived?: boolean;
}
export interface Client { id: string; name: string; country: string; vat: string; contacts: { name: string; role: "dispatch" | "accounting" | "owner"; phone: string; email: string }[]; payDays: number }
export interface Trip {
  id: string; vehicleId: string; clientId: string; type: JobType; date: string; title: string;
  km: number; hours: number; ha: number; units: number;
  revenue: number; litres: number; fuelPrice: number; tolls: number; driver: number; other: number;
  actualRate: number; active: boolean; payment: "paid" | "due" | "overdue"; invoiceNo: string | null; parcelId?: string;
  tariffNote: string;
  /** tonaj transportat (t) și km goi (retur / poziționare) */
  tonnes?: number; emptyKm?: number;
  /** firmă reală: șoferul atribuit (cursă creată din „+ Cursă nouă”) */
  litresSource?: "manual" | "estimate";
  loadedAt?: string | null; deliveredAt?: string | null; cancelledAt?: string | null; cancelReason?: string | null;
  planned?: boolean; driverName?: string; driverId?: string | null;
}
export interface Parcel { id: string; name: string; ha: number; crop: "wheat" | "maize" | "sunflower" | "rapeseed"; poly: LatLng[] }
export interface Zone { id: string; name: string; kind: "depot" | "client"; at: LatLng; radiusM: number }
export interface Doc { id: string; scope: "vehicle" | "driver" | "trip"; ownerId: string; type: string; expires: string | null; provider?: string; userId?: string; dueKm?: number | null; note?: string | null; fileId?: string | null }

export const FUEL_PRICE = 7.3;
const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------- vehicule ----------
/** Baza = consumul de dinainte de Querra Fleet (din istoricul cardului, 60–90 zile). Demo: ~11–14% peste consumul actual. */
const TRUCK_BASE: Record<string, number> = { bh21qrt: 32.0, cj08qrt: 33.1, tm33qrt: 33.4, b120qrt: 34.6, ar45qrt: 33.0, bh77qrt: 31.4, cj52qrt: 34.2, bv19qrt: 32.6, bh88qrt: 32.4, ar12qrt: 33.6, tm61qrt: 34.0, cj90qrt: 31.2, ct14qrt: 35.8, bh42qrt: 33.1 };
export const VEHICLES: Vehicle[] = [
  ...TRUCKS.map((t): Vehicle => ({ id: t.id, name: t.plate, kind: "truck", model: t.model, driver: t.driver, baselineRate: TRUCK_BASE[t.id], per100: true, tankL: t.tankL })),
  { id: "lexion760", name: "Claas Lexion 760", kind: "agri", model: "2019", driver: "Gheorghe Nagy", baselineRate: 19.2, per100: false, tankL: 800, lph: 34.2, engineHours: 2412 },
  { id: "fendt724", name: "Fendt 724 Vario", kind: "agri", model: "2021", driver: "Ion Bara", baselineRate: 24.0, per100: false, tankL: 400, lph: 21.6, engineHours: 3180 },
  { id: "puma240", name: "Case IH Puma 240", kind: "agri", model: "2018", driver: "Radu Fodor", baselineRate: 9.6, per100: false, tankL: 390, lph: 18.9, engineHours: 5640 },
  { id: "bh05qrt", name: "BH 05 QRT", kind: "van", model: "Iveco Daily 35S", driver: "Andrei Sabău", baselineRate: 11.6, per100: true, tankL: 90 },
];
export const vehicleById = (id: string) => VEHICLES.find((v) => v.id === id);

// ---------- clienți ----------
export const CLIENTS: Client[] = [
  { id: "huber", name: "Spedition Huber GmbH", country: "AT", vat: "ATU61234567", payDays: 24, contacts: [{ name: "Katrin Weber", role: "dispatch", phone: "+43 1 234 5678", email: "dispo@huber.example" }, { name: "Thomas Huber", role: "accounting", phone: "+43 1 234 5600", email: "buchhaltung@huber.example" }] },
  { id: "metro", name: "Metro Kft", country: "HU", vat: "HU12345678", payDays: 31, contacts: [{ name: "Zsófia Kiss", role: "dispatch", phone: "+36 1 555 0101", email: "logistics@metro.example" }] },
  { id: "dedeman", name: "Dedeman SRL", country: "RO", vat: "RO2816464", payDays: 18, contacts: [{ name: "Raluca Ionescu", role: "dispatch", phone: "+40 744 000 111", email: "transport@dedeman.example" }] },
  { id: "continental", name: "Continental Logistic SRL", country: "RO", vat: "RO11223344", payDays: 42, contacts: [{ name: "Bogdan Marin", role: "dispatch", phone: "+40 745 222 333", email: "bogdan@contlog.example" }] },
  { id: "transitalia", name: "Trans Italia SRL", country: "IT", vat: "IT01234567890", payDays: 7, contacts: [{ name: "Marco Rossi", role: "owner", phone: "+39 02 1234 567", email: "marco@transitalia.example" }] },
  { id: "agrocampia", name: "Agro Fermier Câmpia", country: "RO", vat: "RO33445566", payDays: 12, contacts: [{ name: "Ferenc Szabó", role: "owner", phone: "+40 740 333 444", email: "ferma@agrocampia.example" }] },
  { id: "slaskpol", name: "Śląsk Logistyka Sp. z o.o.", country: "PL", vat: "PL6340001234", payDays: 30, contacts: [{ name: "Agnieszka Nowak", role: "dispatch", phone: "+48 32 123 4567", email: "dyspozycja@slask.example" }] },
  { id: "rhenus", name: "Rhein Maas Cargo B.V.", country: "NL", vat: "NL812345678B01", payDays: 45, contacts: [{ name: "Joris de Vries", role: "dispatch", phone: "+31 10 555 0199", email: "planning@rmcargo.example" }] },
  { id: "bosfor", name: "Boğaziçi Lojistik A.Ş.", country: "TR", vat: "TR1234567890", payDays: 38, contacts: [{ name: "Elif Yılmaz", role: "dispatch", phone: "+90 212 555 0123", email: "operasyon@bogazici.example" }] },
  { id: "rhonelog", name: "Rhône Logistique SAS", country: "FR", vat: "FR12345678901", payDays: 52, contacts: [{ name: "Camille Martin", role: "accounting", phone: "+33 4 72 00 11 22", email: "compta@rhonelog.example" }] },
];

// ---------- parcele și zone ----------
const rect = (lat: number, lng: number, dLat: number, dLng: number): LatLng[] => [[lat, lng], [lat + dLat, lng], [lat + dLat, lng + dLng], [lat, lng + dLng]];
export const PARCELS: Parcel[] = [
  { id: "lotnord", name: "Lot Nord", ha: 42, crop: "wheat", poly: rect(46.935, 21.785, 0.015, 0.045) },
  { id: "lotsud", name: "Lot Sud", ha: 28, crop: "maize", poly: rect(46.951, 21.735, 0.012, 0.035) },
  { id: "ceica1", name: "Ceica 1", ha: 31, crop: "sunflower", poly: rect(46.855, 22.17, 0.014, 0.04) },
  { id: "salonta2", name: "Salonta 2", ha: 55, crop: "rapeseed", poly: rect(46.79, 21.66, 0.018, 0.05) },
  { id: "tinca4", name: "Tinca 4", ha: 37, crop: "wheat", poly: rect(46.76, 21.93, 0.015, 0.042) },
];
export const ZONES: Zone[] = [
  { id: "dep-oradea", name: "Hub Oradea", kind: "depot", at: [47.0465, 21.9189], radiusM: 1500 },
  { id: "dep-cluj", name: "Hub Cluj", kind: "depot", at: [46.7712, 23.6236], radiusM: 1500 },
  { id: "cl-metro", name: "Metro Kft · Budapesta", kind: "client", at: [47.4979, 19.0402], radiusM: 3000 },
  { id: "cl-dedeman", name: "Dedeman · Sibiu", kind: "client", at: [45.7983, 24.1256], radiusM: 2000 },
  { id: "ferma", name: "Ferma demo", kind: "depot", at: [46.93, 21.77], radiusM: 800 },
];

// ---------- curse și lucrări (1–15 octombrie 2026) ----------
const CLIENT_BY_TRUCK: Record<string, string> = { bh21qrt: "huber", cj08qrt: "rhenus", tm33qrt: "metro", b120qrt: "transitalia", ar45qrt: "rhonelog", bh77qrt: "slaskpol", cj52qrt: "bosfor" };
const RATE_BY_TRUCK = [9.2, 9.8, 9.0, 9.7, 10.4, 9.1, 9.4];
const pad = (n: number) => String(n).padStart(2, "0");
function buildTrips(): Trip[] {
  const out: Trip[] = [];
  const rnd = mulberry32(2026);
  let inv = 120;
  TRUCKS.forEach((t, ti) => {
    const base = TRUCK_BASE[t.id], km = Math.round(routeTotalKm(t)), clientId = CLIENT_BY_TRUCK[t.id];
    // Același coridor, dus și retur în zile separate. Titlul, harta și kilometrii au aceeași origine.
    for (let day = 1 + (ti % 2); day <= 15; day += 2) {
      if (day === 15) continue;
      const back = Math.floor(day / 2) % 2 === 0;
      const title = back ? t.routeName.split(" → ").reverse().join(" → ") : t.routeName;
      const actualRate = r1(base * (0.85 + rnd() * 0.06)), litres = Math.round(km * actualRate / 100);
      const rate = RATE_BY_TRUCK[ti], revenue = Math.round(km * rate / 10) * 10;
      const date = `2026-10-${pad(day)}`, client = CLIENTS.find((c) => c.id === clientId)!;
      const payment: Trip["payment"] = day <= 4 && ti % 3 !== 0 ? "paid" : 15 - day > client.payDays ? "overdue" : "due";
      // Un transport cu cheltuieli neprevăzute: exemplu explicabil de cursă pe pierdere.
      const extra = t.id === "tm33qrt" && day === 13 ? 2800 : 0;
      out.push({ id: `${t.id}-${pad(day)}`, vehicleId: t.id, clientId, type: "transport", date, title, km, hours: r1(km / 64), ha: 0, units: km, revenue, litres, fuelPrice: FUEL_PRICE, tolls: Math.round(km * 1.18), driver: 450, other: Math.round(km * 0.28) + extra, actualRate, tonnes: r1(16 + rnd() * 6), emptyKm: Math.round(km * (0.03 + rnd() * 0.04)), active: false, driverName: t.driver, payment, invoiceNo: `QF-2026-${String(inv++).padStart(4, "0")}`, tariffNote: `${rate} lei/km` });
    }
    const ar = r1(base * 0.89), arrival = dayPlan(t).find((p) => p.kind === "stop" && p.kmStart > 0)!.start;
    out.push({ id: `${t.id}-15`, vehicleId: t.id, clientId, type: "transport", date: DEMO_DAY, title: t.routeName, km, hours: r1(km / 64), ha: 0, units: km, revenue: Math.round(km * RATE_BY_TRUCK[ti] / 10) * 10, litres: Math.round(km * ar / 100), fuelPrice: FUEL_PRICE, tolls: Math.round(km * 1.18), driver: 450, other: Math.round(km * 0.28), actualRate: ar, tonnes: 18 + ti * 0.5, emptyKm: Math.round(km * 0.04), active: true, planned: true, driverName: t.driver, loadedAt: roIso(DEMO_DAY, minToHHMM(t.depMin)), deliveredAt: arrival <= DEMO_NOW_MIN ? roIso(DEMO_DAY, minToHHMM(arrival)) : null, payment: "due", invoiceNo: null, tariffNote: `${RATE_BY_TRUCK[ti]} lei/km` });
  });
  // utilaje agricole: lucrări pe parcele
  const AG: [string, string, JobType, number, number, number, number, number][] = [
    // vehicul, parcelă, tip, L/ha real, ha/h, tarif lei/ha, uzură lei/ha, zi
    ["lexion760", "lotnord", "harvest", 16.8, 3.5, 650, 90, 13],
    ["lexion760", "tinca4", "harvest", 16.6, 3.6, 650, 90, 15],
    ["lexion760", "salonta2", "harvest", 17.1, 3.4, 640, 90, 6],
    ["fendt724", "ceica1", "plough", 21.4, 2.0, 420, 60, 12],
    ["fendt724", "lotsud", "plough", 21.9, 2.1, 420, 60, 8],
    ["fendt724", "lotnord", "plough", 21.2, 2.0, 420, 60, 15],
    ["puma240", "tinca4", "seed", 8.9, 4.1, 260, 30, 11],
    ["puma240", "salonta2", "seed", 9.0, 4.0, 260, 30, 9],
  ];
  for (const [vid, pid, type, lha, haph, tariff, wear, day] of AG) {
    const p = PARCELS.find((x) => x.id === pid)!;
    const ha = day === 15 ? Math.round(p.ha * 0.45) : p.ha;
    const hours = r1(ha / haph);
    out.push({ id: `${vid}-${pid}-${pad(day)}`, vehicleId: vid, clientId: "agrocampia", type, date: `2026-10-${pad(day)}`, title: p.name, km: 0, hours, ha, units: ha, revenue: ha * tariff, litres: Math.round(ha * lha), fuelPrice: FUEL_PRICE, tolls: 0, driver: Math.round(hours * 60), other: ha * wear, actualRate: lha, active: day === 15, payment: day < 10 ? "paid" : "due", invoiceNo: day === 15 ? null : `QF-2026-A${pad(day)}`, parcelId: pid, tariffNote: `${tariff} lei/ha` });
  }
  // utilitara
  for (let day = 2; day <= 14; day += 3) {
    const km = 140 + day * 3;
    out.push({ id: `bh05qrt-${pad(day)}`, vehicleId: "bh05qrt", clientId: "dedeman", type: "transport", date: `2026-10-${pad(day)}`, title: "Oradea · local", km, hours: 7, ha: 0, units: km, revenue: 1450, litres: Math.round(km * 0.104), fuelPrice: FUEL_PRICE, tolls: 0, driver: 380, other: Math.round(km * 0.3), actualRate: 10.4, active: false, payment: day < 5 ? "paid" : "due", invoiceNo: `QF-2026-U${pad(day)}`, tariffNote: "1.450 lei / zi" });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.revenue - a.revenue);
}
export const TRIPS: Trip[] = buildTrips();
export const tripById = (id: string) => TRIPS.find((t) => t.id === id);

// ---------- documente ----------
const D = (days: number) => { const d = new Date(Date.UTC(2026, 9, 15 + days)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const DOCS: Doc[] = [
  { id: "d1", scope: "vehicle", ownerId: "bh21qrt", type: "rca", expires: D(6), provider: "Allianz-Țiriac" },
  { id: "d2", scope: "vehicle", ownerId: "tm33qrt", type: "itp", expires: D(19), provider: "RAR" },
  { id: "d3", scope: "vehicle", ownerId: "b120qrt", type: "vignette", expires: D(28), provider: "CNAIR" },
  { id: "d4", scope: "vehicle", ownerId: "cj08qrt", type: "tacho", expires: D(140) },
  { id: "d5", scope: "vehicle", ownerId: "lexion760", type: "casco", expires: D(258), provider: "Groupama" },
  { id: "d6", scope: "vehicle", ownerId: "bh77qrt", type: "rca", expires: D(201), provider: "Omniasig" },
  { id: "d7", scope: "driver", ownerId: "Mihai Dobre", type: "tachoCard", expires: D(11) },
  { id: "d8", scope: "driver", ownerId: "Ioan Pop", type: "licence", expires: D(1460) },
  { id: "d9", scope: "driver", ownerId: "Ioan Pop", type: "cpc", expires: D(690) },
  { id: "d10", scope: "driver", ownerId: "Gheorghe Nagy", type: "licence", expires: D(900) },
  { id: "d11", scope: "trip", ownerId: "bh21qrt-15", type: "cmr", expires: null },
  { id: "d12", scope: "trip", ownerId: "cj08qrt-14", type: "pod", expires: null },
  { id: "d13", scope: "trip", ownerId: "cj08qrt-14", type: "cmr", expires: null },
];
export interface Service { vehicleId: string; kind: "oil" | "service500" | "tyres"; remaining: number; unit: "km" | "h" | "days"; progress: number }
export const SERVICES: Service[] = [
  { vehicleId: "bh21qrt", kind: "oil", remaining: 2400, unit: "km", progress: 0.84 },
  { vehicleId: "lexion760", kind: "service500", remaining: 38, unit: "h", progress: 0.92 },
  { vehicleId: "tm33qrt", kind: "tyres", remaining: 41, unit: "days", progress: 0.4 },
];
