import type { Trip } from "./fleet/seed";
import type { PosRow } from "./store/types";
import { isDate, localNow } from "./validate";

export type ReplayWindow = { kind: "trip" | "day"; date: string; from: string; until: string };
export function dayReplayWindow(date: string): ReplayWindow | null {
  if (!isDate(date)) return null;
  const next = new Date(Date.parse(date + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  return { kind: "day", date, from: `${date}T00:00`, until: `${next}T00:00` };
}
export function tripReplayWindow(trip: Pick<Trip, "date" | "loadedAt" | "deliveredAt" | "planned" | "active" | "cancelledAt">, now = new Date()): ReplayWindow | null {
  if (trip.cancelledAt) return null;
  const active = trip.planned ?? trip.active;
  if (!trip.loadedAt) return active && !trip.deliveredAt ? null : dayReplayWindow(trip.date);
  const start = Date.parse(trip.loadedAt), end = trip.deliveredAt ? Date.parse(trip.deliveredAt) : active ? now.getTime() : NaN;
  if (!Number.isFinite(start) || start > now.getTime()) return null;
  if (!Number.isFinite(end)) return dayReplayWindow(trip.date);
  if (end <= start) return null;
  // Stored phone positions currently have Bucharest wall-clock minute precision.
  // The end is exclusive so an adjacent trip's loading minute is not replayed here.
  const from = localNow(new Date(start)), until = localNow(new Date(Math.min(end, now.getTime())));
  if (until <= from) return null;
  return { kind: "trip", date: from.slice(0, 10), from, until };
}
export function windowPositions(positions: PosRow[], vehicleId: string, window: ReplayWindow): PosRow[] {
  const seen = new Set<number>();
  return positions.filter(p => p.truckId === vehicleId && p.at >= window.from && p.at < window.until
    && Number.isFinite(replayMinute(p.at, window.date)) && isDate(p.at.slice(0, 10))
    && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .sort((a, b) => a.at.localeCompare(b.at)).filter(p => { const time = replayMinute(p.at, window.date); if (seen.has(time)) return false; seen.add(time); return true; });
}
export function replayMinute(at: string, date: string): number {
  return (Date.parse(at + (/[zZ]$|[+-]\d\d:\d\d$/.test(at) ? "" : "Z")) - Date.parse(date + "T00:00:00Z")) / 60000;
}
