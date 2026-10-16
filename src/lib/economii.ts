// Reference differences and illustrative scenarios. Alerts never quantify savings/loss.
import { sumSavings } from "./calc";
import { reportViews, type TripView } from "./query";
import type { AppAlert } from "./repo";
import type { Vehicle } from "./fleet/seed";

export const ASSUME = { eurRon: 5.3414, eurDate: "2026-10-09", hourLei: 50, hoursPerTruck: 3, fineLei: 4500, cashPerTruckMonth: 49 };
const r0 = (n: number) => Math.round(n);
export function economii(views: TripView[], alerts: AppAlert[], vehicles: Vehicle[], days: number) {
  const done = reportViews(views).filter((v) => !v.active);
  const months = Math.max(days, 1) / 30;
  const price = done.length ? done.reduce((s, v) => s + v.fuelPrice, 0) / done.length : 7.29;
  const fuel = sumSavings(done.map((v) => v.s));
  const anomalyCount = alerts.filter((a) => a.theft).length;
  const docsN = alerts.filter((a) => a.rule === "doc-expiry").length;
  const trucks = vehicles.length;
  const hours = r0(trucks * ASSUME.hoursPerTruck * months);
  const lines = {
    fuel: r0(fuel.savedLei),
    docs: r0(docsN * ASSUME.fineLei * 0.1), // 10% șanse de amendă + zi pierdută, per document prins la timp (estimare)
    time: r0(hours * ASSUME.hourLei),
    cash: r0(trucks * ASSUME.cashPerTruckMonth * months),
  };
  // Scenarios are kept separate from the difference calculated from trip records.
  const total = lines.fuel;
  const perTruck = vehicles.map((v) => ({ v, lei: r0(done.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.s.savedLei, 0)), pct: sumSavings(done.filter((t) => t.vehicleId === v.id).map((t) => t.s)).pct })).filter((x) => x.lei !== 0);
  perTruck.sort((a, b) => b.lei - a.lei);
  return { lines, total, eur: r0(total / ASSUME.eurRon), hours, fuel, anomalyCount, docsN, price, months, year: r0((total / months) * 12), yearEur: r0((total / months) * 12 / ASSUME.eurRon), best: perTruck.slice(0, 3), worst: perTruck.slice(-3).reverse().filter((x) => x.lei < 0) };
}
