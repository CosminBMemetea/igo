// igo: reguli de acces (pure, testate în smoke:auth). Folosite de middleware.
import type { Session } from "./session";
import type { PlanState } from "./features";

export const PUBLIC_PATHS = [/^\/login$/, /^\/api\/auth\//];
export const isPublic = (path: string) => PUBLIC_PATHS.some((r) => r.test(path));
export type Decision = { kind: "allow" } | { kind: "login" } | { kind: "unauthorized" };
export function decide(path: string, s: Session | null): Decision {
  if (isPublic(path) || s) return { kind: "allow" };
  return path.startsWith("/api/") ? { kind: "unauthorized" } : { kind: "login" };
}
/** Cookie-urile de previzualizare (?plan=, ?view=) se acceptă doar de la admin. */
export const canSwitchPlan = (s: Session | null) => s?.role === "admin";
export type View = "admin" | "user";
/** Planul efectiv: admin în mod Admin vede tot; admin în mod Utilizator vede planul ales; userul vede planul firmei. */
export function effectivePlan(s: Session | null, view: View, previewPlan: PlanState, firmPlan: PlanState): { plan: PlanState; adminView: boolean } {
  if (s?.role === "admin") return view === "user" ? { plan: previewPlan, adminView: false } : { plan: "trial", adminView: true };
  return { plan: firmPlan, adminView: false };
}
