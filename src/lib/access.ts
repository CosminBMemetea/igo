// Querra Fleet: reguli de acces (pure, testate în smoke:auth). Folosite de middleware.
import type { Session } from "./session";
import type { PlanState } from "./features";

export const PUBLIC_PATHS = [/^\/login$/, /^\/signup$/, /^\/join$/, /^\/api\/auth\//];
export const isPublic = (path: string) => PUBLIC_PATHS.some((r) => r.test(path));
/** Șoferul vede doar interfața lui (+ asistență). */
export const DRIVER_PATHS = [/^\/driver$/, /^\/api\/driver\//, /^\/api\/receipt\//, /^\/support$/, /^\/api\/support$/];
/** Doar proprietar/admin. */
export const OWNER_PATHS = [/^\/setup$/, /^\/api\/setup\//, /^\/api\/firm\//, /^\/import$/, /^\/api\/import\//];
export const ADMIN_PATHS = [/^\/admin$/, /^\/api\/admin\//];
export type Decision = { kind: "allow" } | { kind: "login" } | { kind: "unauthorized" } | { kind: "forbidden"; home: string };
export function decide(path: string, s: Session | null): Decision {
  if (isPublic(path)) return { kind: "allow" };
  if (!s) return path.startsWith("/api/") ? { kind: "unauthorized" } : { kind: "login" };
  const deny = { kind: "forbidden", home: s.role === "driver" ? "/driver" : "/" } as const;
  if (s.role === "driver" && !DRIVER_PATHS.some((r) => r.test(path))) return deny;
  if (OWNER_PATHS.some((r) => r.test(path)) && s.role !== "owner" && s.role !== "admin") return deny;
  if (ADMIN_PATHS.some((r) => r.test(path)) && s.role !== "admin") return deny;
  return { kind: "allow" };
}
/** Cookie-urile de previzualizare (?plan=, ?view=) se acceptă doar de la admin. */
export const canSwitchPlan = (s: Session | null) => s?.role === "admin";
export type View = "admin" | "user";
/** Planul efectiv: admin în mod Admin vede tot; admin în mod Utilizator vede planul ales; userul vede planul firmei. */
export function effectivePlan(s: Session | null, view: View, previewPlan: PlanState, firmPlan: PlanState): { plan: PlanState; adminView: boolean } {
  if (s?.role === "admin") return view === "user" ? { plan: previewPlan, adminView: false } : { plan: "trial", adminView: true };
  return { plan: firmPlan, adminView: false };
}
