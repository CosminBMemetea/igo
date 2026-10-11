// iGo: ecranul „Economii” — măsurat din datele firmei + proiecție. Ipotezele (estimări) vin din VALUE-PLAN.md §3.
import { sumSavings } from "./calc";
import type { TripView } from "./query";
import type { AppAlert } from "./repo";
import type { Vehicle } from "./fleet/seed";

export const ASSUME = { eurRon: 5.3414, eurDate: "2026-10-09", hourLei: 50, hoursPerTruck: 3, fineLei: 4500, cashPerTruckMonth: 49 };
const r0 = (n: number) => Math.round(n);
/** Litri „la risc” dintr-o alertă de furt (cât s-ar fi pierdut). */
export function theftLitres(a: AppAlert, normal: number): number {
  const p = a.params as Record<string, number>;
  switch (a.rule) {
    case "peste-capacitate": return +p.excess || 0;
    case "scadere-parcat": return +p.drop || 0;
    case "card-fara-camion": return +p.litres || 0;
    case "km-nepotrivit": return Math.max(0, +p.litres - (+p.gpsKm * normal) / 100);
    case "consum-peste-medie": case "l100-mare": return (+p.litres * +p.pct) / (100 + +p.pct);
    case "dubla": return p.tank && +p.total > +p.tank ? +p.total - +p.tank : 0;
    default: return 0;
  }
}
export function economii(views: TripView[], alerts: AppAlert[], vehicles: Vehicle[], days: number) {
  const done = views.filter((v) => !v.active);
  const months = Math.max(days, 1) / 30;
  const price = done.length ? done.reduce((s, v) => s + v.fuelPrice, 0) / done.length : 7.29;
  const fuel = sumSavings(done.map((v) => v.s));
  const theftL = alerts.filter((a) => a.theft).reduce((s, a) => s + theftLitres(a, vehicles.find((v) => v.id === a.vehicleId)?.baselineRate ?? 30), 0);
  const docsN = alerts.filter((a) => a.rule === "doc-expiry").length;
  const trucks = vehicles.length;
  const hours = r0(trucks * ASSUME.hoursPerTruck * months);
  const lines = {
    fuel: r0(fuel.savedLei),
    theft: r0(theftL * price),
    docs: r0(docsN * ASSUME.fineLei * 0.1), // 10% șanse de amendă + zi pierdută, per document prins la timp (estimare)
    time: r0(hours * ASSUME.hourLei),
    cash: r0(trucks * ASSUME.cashPerTruckMonth * months),
  };
  const total = Object.values(lines).reduce((s, x) => s + x, 0);
  const perTruck = vehicles.map((v) => ({ v, lei: r0(done.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.s.savedLei, 0)), pct: sumSavings(done.filter((t) => t.vehicleId === v.id).map((t) => t.s)).pct })).filter((x) => x.lei !== 0);
  perTruck.sort((a, b) => b.lei - a.lei);
  return { lines, total, eur: r0(total / ASSUME.eurRon), hours, fuel, theftL: r0(theftL), docsN, price, months, year: r0((total / months) * 12), yearEur: r0((total / months) * 12 / ASSUME.eurRon), best: perTruck.slice(0, 3), worst: perTruck.slice(-3).reverse().filter((x) => x.lei < 0) };
}
