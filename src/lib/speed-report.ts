import type { Store } from "./store/types";
import type { SpeedEventRow } from "./speed";
export const SPEED_PERIODS = [7, 30, 90] as const;
export type SpeedFilter = { days: number; truckId: string; userId: string };
export function speedFilter(q: { days?: string; truck?: string; driver?: string }): SpeedFilter {
  const d = Number(q.days);
  return { days: (SPEED_PERIODS as readonly number[]).includes(d) ? d : 30, truckId: (q.truck ?? "").slice(0, 64), userId: (q.driver ?? "").slice(0, 64) };
}
/** Evenimentele firmei cu filtre; truck/driver străine firmei nu întorc nimic (filtrul e pe firmId). */
export async function speedReport(s: Store, firmId: string, f: SpeedFilter, now = Date.now()) {
  const [events, trucks, users] = await Promise.all([
    s.speedEvents(firmId, { sinceAt: new Date(now - f.days * 86400_000).toISOString(), truckId: f.truckId || undefined, userId: f.userId || undefined, limit: 2000 }),
    s.trucks(firmId), s.users(firmId),
  ]);
  const plate = new Map(trucks.map(t => [t.id, t.plate])), name = new Map(users.map(u => [u.id, u.name]));
  const rows = events.filter(e => !e.open || e.samples >= 2).map((e: SpeedEventRow) => ({ e, plate: plate.get(e.truckId) ?? "", driver: e.userId ? name.get(e.userId) ?? "" : "" }));
  return { rows, trucks: trucks.filter(t => !t.archivedAt), drivers: users.filter(u => u.role === "driver") };
}
export const fmtLocal = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
