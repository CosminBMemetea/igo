import type { Trip } from "./fleet/seed";
import type { PosRow } from "./store/types";
import { isDate, localNow } from "./validate";

export type ReplayWindow = { kind: "trip" | "day"; date: string; from: string; until: string; utcFrom?: string; utcUntil?: string };
export function dayReplayWindow(date: string): ReplayWindow | null {
  if (!isDate(date)) return null;
  const next = new Date(Date.parse(date + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  return { kind: "day", date, from: `${date}T00:00`, until: `${next}T00:00`, utcFrom: new Date(bucharestEpoch(`${date}T00:00`)).toISOString(), utcUntil: new Date(bucharestEpoch(`${next}T00:00`)).toISOString() };
}
export function tripReplayWindow(trip: Pick<Trip, "date" | "loadedAt" | "deliveredAt" | "planned" | "active" | "cancelledAt">, now = new Date()): ReplayWindow | null {
  if (trip.cancelledAt) return null;
  const active = trip.planned ?? trip.active;
  if (!trip.loadedAt) return active && !trip.deliveredAt ? null : dayReplayWindow(trip.date);
  const start = Date.parse(trip.loadedAt), end = trip.deliveredAt ? Date.parse(trip.deliveredAt) : active ? now.getTime() : NaN;
  if (!Number.isFinite(start) || start > now.getTime()) return null;
  if (!Number.isFinite(end)) return dayReplayWindow(trip.date);
  if (end <= start) return null;
  // Local labels are retained for legacy data; exact UTC bounds isolate new fixes.
  const from = localNow(new Date(start)), until = localNow(new Date(Math.min(end, now.getTime())));

  return { kind: "trip", date: from.slice(0, 10), from, until, utcFrom: new Date(start).toISOString(), utcUntil: new Date(Math.min(end, now.getTime())).toISOString() };
}
/** Legacy wall-clock values have no offset; use the earlier occurrence if ambiguous.
 * New positions always carry capturedAt, so DST never needs this fallback. */
export function bucharestEpoch(at: string): number {
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(at)) return Date.parse(at);
  const wall = Date.parse(at + "Z");
  for (const offset of [3, 2]) {
    const candidate = wall - offset * 3600000;
    if (Number.isFinite(candidate) && localNow(new Date(candidate)) === at.slice(0, 16)) return candidate;
  }
  return NaN;
}
export const positionEpoch = (p: PosRow) => p.capturedAt ? Date.parse(p.capturedAt) : bucharestEpoch(p.at);
/** Query a superset by local date; UTC filtering below selects the exact trip. */
export function replayQueryBounds(window: ReplayWindow) {
  const dates = [window.from.slice(0, 10), window.until.slice(0, 10)].sort();
  return { from: dates[0] + "T00:00", until: dayReplayWindow(dates[1])!.until };
}
export function windowPositions(positions: PosRow[], vehicleId: string, window: ReplayWindow): PosRow[] {
  const seen = new Set<number>();
  return positions.filter(p => {
    const time = positionEpoch(p);
    const within = p.capturedAt && window.utcFrom && window.utcUntil
      ? time >= Date.parse(window.utcFrom) && time < Date.parse(window.utcUntil)
      : p.at >= window.from && p.at < window.until;
    return p.truckId === vehicleId && within && Number.isFinite(time) && isDate(p.at.slice(0, 10))
      && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  }).sort((a,b) => positionEpoch(a) - positionEpoch(b)).filter(p => { const time = positionEpoch(p); if (seen.has(time)) return false; seen.add(time); return true; });
}
export function replayMinute(at: string, date: string): number {
  return (Date.parse(at + (/[zZ]$|[+-]\d\d:\d\d$/.test(at) ? "" : "Z")) - Date.parse(date + "T00:00:00Z")) / 60000;
}
