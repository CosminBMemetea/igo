import { projectedBoard, type Snapshot, type WorkEntry, type EventKind } from "./work-queue";

export type TripIntent = { tripId: string; truckId: string; shiftStart: string; kind: EventKind };

/** Alerts can remain open across refreshes. Validate the latest durable state,
 * including offline actions, instead of the render that opened the alert. */
export function confirmTripEvent(snapshot: Snapshot | null, entries: WorkEntry[], intent: TripIntent, now = Date.now()) {
  if (!snapshot || now - snapshot.savedAt > 86400000 || now < snapshot.savedAt - 300000) throw new Error("Actualizează datele cursei înainte de a confirma etapa.");
  const board = projectedBoard(snapshot, entries);
  if (board.truck?.id !== intent.truckId || board.shift?.start !== intent.shiftStart || board.shift.end || board.shift.privateSince) throw new Error("Camionul sau tura s-a schimbat. Verifică datele actualizate înainte de a continua.");
  const trip = [...board.trips.running, ...board.trips.ready].find(t => t.id === intent.tripId && t.truckId === intent.truckId);
  if (!trip || trip.cancelledAt || trip.deliveredAt || !trip.planned) throw new Error("Cursa nu mai permite această etapă. Verifică lista actualizată.");
  if (entries.some(e => e.tripId === trip.id && e.status === "attention")) throw new Error("Verifică mai întâi operațiile acestei curse din Acte → Sincronizare.");
  const valid = intent.kind === "loaded" ? !trip.loadedAt && !trip.waitSince
    : intent.kind === "unloaded" ? !!trip.loadedAt && !trip.waitSince
    : intent.kind === "wait_start" ? !trip.waitSince : !!trip.waitSince;
  if (!valid) throw new Error("Etapa cursei s-a schimbat. Verifică starea actuală înainte de a confirma.");
  return trip;
}
