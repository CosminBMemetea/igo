// Agregări: cost real / km pe camion, grad de încărcare, km goi (doar curse încheiate, doar camioane din flotă).
import type { TripView } from "./query";
import type { Vehicle } from "./fleet/seed";
export interface VEcon { v: Vehicle; n: number; km: number; costs: number; revenue: number; profit: number; cpk: number; margin: number; loadPct: number | null; emptyKm: number; tonnes: number }
export function econOf(v: Vehicle, views: TripView[]): VEcon {
  const done = views.filter((x) => x.vehicleId === v.id && !x.active && x.e);
  let km = 0, costs = 0, revenue = 0, profit = 0, used = 0, cap = 0, emptyKm = 0, tonnes = 0, known = false;
  for (const x of done) {
    const e = x.e!; km += x.km; costs += e.costs; revenue += x.revenue; profit += e.profit; emptyKm += e.emptyKm;
    if (e.tonnes !== null) { known = true; tonnes += e.tonnes; used += e.tonnes * (x.km - e.emptyKm); cap += e.capacityT * x.km; }
  }
  return { v, n: done.length, km, costs, revenue, profit, cpk: km ? costs / km : 0, margin: revenue ? profit / revenue : 0, loadPct: known && cap ? used / cap : null, emptyKm, tonnes };
}
export function fleetEcon(vehicles: Vehicle[], views: TripView[]) {
  const rows = vehicles.filter((v) => v.kind === "truck" || v.kind === "van").map((v) => econOf(v, views)).filter((r) => r.n > 0);
  const sum = (f: (r: VEcon) => number) => rows.reduce((a, r) => a + f(r), 0);
  const km = sum((r) => r.km), costs = sum((r) => r.costs), revenue = sum((r) => r.revenue), profit = sum((r) => r.profit);
  const done = views.filter((x) => !x.active && x.e), used = done.reduce((a, x) => a + (x.e!.tonnes ?? 0) * (x.km - x.e!.emptyKm), 0), cap = done.filter((x) => x.e!.tonnes !== null).reduce((a, x) => a + x.e!.capacityT * x.km, 0);
  return { rows, n: done.length, km, costs, revenue, profit, margin: revenue ? profit / revenue : 0, cpk: km ? costs / km : 0, loadPct: cap ? used / cap : null, emptyKm: sum((r) => r.emptyKm) };
}
