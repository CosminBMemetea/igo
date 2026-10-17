import type { TripRow } from "./store/types";
export type DriverTripStage = "running" | "ready" | "upcoming" | "documents" | "finished" | "cancelled";
export function driverTripStage(trip: TripRow, today: string): DriverTripStage {
  if (trip.cancelledAt) return "cancelled";
  if (trip.deliveredAt) return trip.podReceived ? "finished" : "documents";
  if (trip.loadedAt) return "running";
  if (!trip.planned) return "finished";
  return trip.date > today ? "upcoming" : "ready";
}
export function groupDriverTrips(trips: TripRow[], today: string) {
  const groups: Record<DriverTripStage, TripRow[]> = { running: [], ready: [], upcoming: [], documents: [], finished: [], cancelled: [] };
  for (const trip of trips) groups[driverTripStage(trip, today)].push(trip);
  for (const [stage, rows] of Object.entries(groups)) rows.sort((a, b) => (stage === "finished" || stage === "cancelled" ? -1 : 1) * a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return groups;
}
