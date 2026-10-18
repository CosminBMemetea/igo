import type { DriverTripSummary } from "./driver-trips";
export const DRIVER_TRIP_UPDATE = "qf-demo-trip-update";
export type DriverTripUpdate = { tripId: string; kind: "loaded" | "unloaded" | "pod"; at: string };
/** Demo-only projection. Real trips are refreshed from authenticated server data. */
export function applyDriverTripUpdate(trip: DriverTripSummary, update: DriverTripUpdate): DriverTripSummary {
  if (trip.id !== update.tripId || trip.cancelledAt || !Number.isFinite(Date.parse(update.at))) return trip;
  if (update.kind === "pod") return { ...trip, podReceived: true };
  if (!trip.planned || trip.deliveredAt) return trip;
  if (update.kind === "loaded") return trip.loadedAt ? trip : { ...trip, loadedAt: update.at };
  if (!trip.loadedAt || Date.parse(update.at) < Date.parse(trip.loadedAt)) return trip;
  return { ...trip, deliveredAt: update.at };
}
