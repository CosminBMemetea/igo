import type { TripRow, UserRow } from "./store/types";

export const DRIVER_BADGES = [{ count: 1, label: "Prima livrare documentată" }, { count: 5, label: "5 livrări documentate" }, { count: 10, label: "10 livrări documentate" }, { count: 25, label: "25 de livrări documentate" }];
const day = (at: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
/** Activity only: never infer safety, fuel savings or a cash entitlement from GPS. */
export function driverActivity(users: UserRow[], trips: TripRow[], today: string) {
  const since = new Date(Date.parse(today) - 29 * 86400000).toISOString().slice(0, 10);
  const complete = trips.filter(t => !t.cancelledAt && t.deliveredAt && Number.isFinite(Date.parse(t.deliveredAt)) && t.podReceived && day(t.deliveredAt) <= today);
  const rows = users.filter(u => u.role === "driver" && !u.disabledAt && !!u.passwordHash).map(u => {
    const mine = complete.filter(t => t.driverId === u.id && t.firmId === u.firmId);
    return { id: u.id, name: u.name, completed: mine.filter(t => day(t.deliveredAt!) >= since).length, lifetime: mine.length };
  }).sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const participants = rows.filter(r => r.completed > 0).length;
  return { since, until: today, participants, rows: rows.map(r => ({ ...r, rank: participants >= 3 && r.completed > 0 ? 1 + rows.filter(other => other.completed > r.completed).length : null })) };
}
export function driverProgress(users: UserRow[], trips: TripRow[], uid: string, today: string) {
  const activity = driverActivity(users, trips, today), mine = activity.rows.find(r => r.id === uid);
  const lifetime = mine?.lifetime ?? 0;
  return { since: activity.since, until: activity.until, completed: mine?.completed ?? 0, lifetime, rank: mine?.rank ?? null, participants: activity.participants,
    badges: DRIVER_BADGES.filter(b => lifetime >= b.count), next: DRIVER_BADGES.find(b => lifetime < b.count) ?? null };
}
