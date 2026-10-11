// Progresul setup-ului ghidat (5 pași), calculat din datele firmei.
import type { Store } from "./store/types";
export const STEPS = [1, 2, 3, 4, 5] as const;
export type Step = (typeof STEPS)[number];
export async function setupState(s: Store, firmId: string) {
  const [firm, trucks, invites, users, docs, trips] = await Promise.all([s.firm(firmId), s.trucks(firmId), s.invites(firmId), s.users(firmId), s.docs(firmId), s.trips(firmId)]);
  const done: Record<Step, boolean> = { 1: !!firm?.detailsDone, 2: trucks.length > 0, 3: invites.length > 0 || users.some((u) => u.role === "driver"), 4: docs.length > 0, 5: trips.length > 0 || !!firm?.csvSkipped };
  const n = STEPS.filter((k) => done[k]).length;
  const next = STEPS.find((k) => !done[k]) ?? null;
  return { firm, trucks, invites, users, docs, trips, done, n, next, complete: n === 5 };
}
