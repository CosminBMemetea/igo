import type { TripRow } from "./store/types";
export type DriverTripSummary = Pick<TripRow, "id" | "truckId" | "client" | "title" | "date" | "planned" | "loadedAt" | "deliveredAt" | "cancelledAt" | "cancelReason" | "podReceived">;
/** Explicit allowlist: never serialize revenue, costs or company data to the driver board. */
export function driverTripSummary(x: DriverTripSummary): DriverTripSummary {
  return { id: x.id, truckId: x.truckId, client: x.client, title: x.title, date: x.date, planned: x.planned, loadedAt: x.loadedAt, deliveredAt: x.deliveredAt, cancelledAt: x.cancelledAt, cancelReason: x.cancelReason, podReceived: x.podReceived };
}
export type DriverTripStage = "running" | "ready" | "upcoming" | "documents" | "finished" | "cancelled";
export function driverTripStage(trip: DriverTripSummary, today: string): DriverTripStage {
  if (trip.cancelledAt) return "cancelled";
  if (trip.deliveredAt) return trip.podReceived ? "finished" : "documents";
  if (!trip.planned) return "finished";
  if (trip.loadedAt) return "running";
  return trip.date > today ? "upcoming" : "ready";
}
export function groupDriverTrips(trips: DriverTripSummary[], today: string) {
  const groups: Record<DriverTripStage, DriverTripSummary[]> = { running: [], ready: [], upcoming: [], documents: [], finished: [], cancelled: [] };
  for (const trip of trips) groups[driverTripStage(trip, today)].push(trip);
  for (const [stage, rows] of Object.entries(groups)) rows.sort((a, b) => (stage === "finished" || stage === "cancelled" ? -1 : 1) * a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return groups;
}
export function defaultDriverTrip(trips: DriverTripSummary[], today: string, truckId?: string | null) {
  const groups = groupDriverTrips(trips.filter(x => x.truckId === truckId), today);
  return groups.running[0] ?? groups.ready[0];
}
