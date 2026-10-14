export type TripStage = "planned" | "loaded" | "delivered" | "completed" | "cancelled";
export interface TripProgress { planned?: boolean; loadedAt?: string | null; deliveredAt?: string | null; cancelledAt?: string | null }
export function tripStage(t: TripProgress): TripStage {
  return t.cancelledAt ? "cancelled" : !t.planned ? "completed" : t.deliveredAt ? "delivered" : t.loadedAt ? "loaded" : "planned";
}
export const STAGE_LABELS: Record<TripStage, string> = { planned: "Planificată|Planned|Planowany", loaded: "Încărcată|Loaded|Załadowany", delivered: "Livrată|Delivered|Dostarczony", completed: "Încheiată|Completed|Zakończony", cancelled: "Anulată|Cancelled|Anulowany" };
