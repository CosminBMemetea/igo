export type TripStage = "planned" | "loaded" | "delivered" | "completed" | "cancelled";
export interface TripProgress { planned?: boolean; loadedAt?: string | null; deliveredAt?: string | null; cancelledAt?: string | null }
export function tripStage(t: TripProgress): TripStage {
  return t.cancelledAt ? "cancelled" : !t.planned ? "completed" : t.deliveredAt ? "delivered" : t.loadedAt ? "loaded" : "planned";
}
export const STAGE_LABELS: Record<TripStage, string> = { planned: "Planificată|Planned|Planowany", loaded: "Încărcată|Loaded|Załadowany", delivered: "Livrată|Delivered|Dostarczony", completed: "Încheiată|Completed|Zakończony", cancelled: "Anulată|Cancelled|Anulowany" };
/** Calendar day (YYYY-MM-DD) of an instant in Europe/Bucharest. */
export const bucharestDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
/**
 * The one definition of a finished trip for scores and rankings (fuel and speed): stage "completed" (closed, not cancelled;
 * demo rows use `active` for planned). Day = delivery day in Europe/Bucharest when a valid delivery time exists, else the
 * trip date (manual trips marked done without a delivery time). Null = not finished.
 */
export function completedDay(t: TripProgress & { date: string; active?: boolean }): string | null {
  if (tripStage({ ...t, planned: t.planned ?? t.active }) !== "completed") return null;
  if (t.deliveredAt && Number.isFinite(Date.parse(t.deliveredAt))) return bucharestDay(t.deliveredAt);
  return /^\d{4}-\d{2}-\d{2}/.test(t.date ?? "") ? t.date.slice(0, 10) : null;
}
