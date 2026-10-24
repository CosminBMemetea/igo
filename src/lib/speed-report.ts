import type { Store } from "./store/types";
import { unsentChannels, type SpeedEventRow } from "./speed";
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
  const plate = new Map(trucks.map(t => [t.id, t.plate])), name = new Map(users.map(u => [u.id, u.name])), owners = users.filter(u => u.role === "owner" && !u.disabledAt);
  const rows = events.filter(e => !e.open || e.samples >= 2).map((e: SpeedEventRow) => ({ e, plate: plate.get(e.truckId) ?? "", driver: e.userId ? name.get(e.userId) ?? "" : "", unsent: unsentChannels(e, owners) }));
  return { rows, trucks: trucks.filter(t => !t.archivedAt), drivers: users.filter(u => u.role === "driver") };
}
export const fmtLocal = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(iso));
/** Romania local time as ISO 8601 with its UTC offset (+02:00 winter / +03:00 summer), unambiguous across the DST change (e.g. 25 Oct 03:00–04:00 happens twice). */
export const isoLocal = (iso: string) => {
  const wall = fmtLocal(iso), [y, mo, d, h, mi, se] = wall.split(/[- :]/).map(Number);
  const off = Math.round((Date.UTC(y, mo - 1, d, h, mi, se) - Math.floor(Date.parse(iso) / 1000) * 1000) / 60_000), a = Math.abs(off);
  return `${wall.replace(" ", "T")}${off < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
};
import { speedParts, bucharestDay, type SpeedPart } from "./speed";
/** Real firm only: per-truck speed component (0..1) for the driver score; {} for demo or too little data. */
export async function realSpeedParts(s: Store, firmId: string | null | undefined, demo: boolean, now = Date.now()): Promise<Record<string, SpeedPart>> {
  if (demo || !firmId) return {};
  const sinceAt = new Date(now - 29 * 86400_000), [trips, events] = await Promise.all([s.trips(firmId), s.speedEvents(firmId, { sinceAt: new Date(sinceAt.getTime() - 86400_000).toISOString(), limit: 5000 })]);
  return speedParts(trips, events, bucharestDay(sinceAt.toISOString()));
}
