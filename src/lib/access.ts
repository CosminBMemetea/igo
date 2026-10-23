// Querra Fleet: reguli de acces (pure, testate în smoke:auth). Folosite de middleware.
import type { Session } from "./session";
import type { PlanState } from "./features";

export const PUBLIC_PATHS = [/^\/login$/, /^\/privacy$/, /^\/subprocessors$/, /^\/visibility$/, /^\/terms$/, /^\/robots\.txt$/, /^\/sw\.js$/, /^\/signup$/, /^\/incearca$/, /^\/api\/leads$/, /^\/join$/, /^\/forgot$/, /^\/reset$/, /^\/api\/auth\/forgot$/, /^\/api\/auth\/reset$/, /^\/api\/auth\//, /^\/api\/cron\//];
export const isPublic = (path: string) => PUBLIC_PATHS.some((r) => r.test(path));
/** Șoferul vede doar interfața lui (+ asistență). */
export const DRIVER_PATHS = [/^\/driver$/, /^\/join\/ready$/, /^\/driver\/trips\/[\w-]+$/, /^\/api\/driver\//, /^\/api\/receipt\//, /^\/support$/, /^\/api\/support$/, /^\/notifications$/, /^\/api\/notifications\//, /^\/api\/files(\/[\w-]+)?$/, /^\/api\/trips\/event$/, /^\/api\/me\/locale$/];
/** Doar proprietar/admin. */
export const OWNER_PATHS = [/^\/trucks$/, /^\/drivers$/, /^\/api\/drivers\//,/^\/setup$/, /^\/api\/setup\//, /^\/api\/firm\//, /^\/import$/, /^\/api\/import\//, /^\/api\/docs(\/|$)/, /^\/api\/trips\/pod$/, /^\/speeding$/, /^\/api\/speeding\//, /^\/api\/settings\//];
/** Demo („Intră ca demo”): poate încerca importul CSV — totul în memorie, nimic în baza de date. */
export const DEMO_OK = [/^\/speeding$/, /^\/drivers$/, /^\/trucks$/, /^\/import$/, /^\/api\/import\/(preview|commit)$/];
/** Demo („user”): /api/* is deny-by-default; only these read/demo-safe routes (no DB writes for the demo firm). */
export const DEMO_API_OK = [/^\/api\/alerts$/, /^\/api\/ask$/, /^\/api\/feed\/(react|resolve)$/, /^\/api\/files(\/[\w-]+)?$/, /^\/api\/live$/, /^\/api\/me\/locale$/, /^\/api\/notifications\/(read|push|settings)$/, /^\/api\/receipt\/extract$/, /^\/api\/support$/, /^\/api\/trips$/, /^\/api\/trips\/parse$/, /^\/api\/vehicles$/, /^\/api\/vehicles\/econ$/, /^\/api\/import\/(preview|commit)$/];
export const ADMIN_PATHS = [/^\/admin$/, /^\/api\/admin\//];
/** Pagina de start a fiecărui rol după autentificare. */
/** pagina de start: șofer → /driver, admin → /admin, patron → Fluxul flotei (/feed; firmă fără date live → /feed trimite la Acasă) */
export const roleHome = (r: Session["role"]) => (r === "driver" ? "/driver" : r === "admin" ? "/admin" : r === "user" ? "/" : "/feed");
export type Decision = { kind: "allow" } | { kind: "login" } | { kind: "unauthorized" } | { kind: "forbidden"; home: string };
export function decide(path: string, s: Session | null): Decision {
  if (isPublic(path)) return { kind: "allow" };
  if (!s) return path.startsWith("/api/") ? { kind: "unauthorized" } : { kind: "login" };
  const deny = { kind: "forbidden", home: roleHome(s.role) } as const;
  if (s.role === "driver" && !DRIVER_PATHS.some((r) => r.test(path))) return deny;
  if (s.role === "user" && path.startsWith("/api/") && !DEMO_API_OK.some((r) => r.test(path))) return deny;
  if (OWNER_PATHS.some((r) => r.test(path)) && s.role !== "owner" && s.role !== "admin" && !(s.role === "user" && DEMO_OK.some((r) => r.test(path)))) return deny;
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
