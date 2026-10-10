import { cookies, headers } from "next/headers";
import { isLocale, pickLocale, type Locale } from "./i18n";
import { TRIAL_DAYS, isPlanState, type PlanState } from "./features";
import { effectivePlan, type View } from "./access";
import type { Role } from "./session";

export interface Prefs { loc: Locale; theme: "dark" | "light"; plan: PlanState; trialLeft: number; role: Role | null; email: string | null; view: View; adminView: boolean; previewPlan: PlanState }
export function getPrefs(): Prefs {
  const c = cookies(), h = headers();
  const l = c.get("igo-locale")?.value;
  const loc = isLocale(l) ? l : pickLocale(h.get("accept-language"));
  const theme = c.get("igo-theme")?.value === "light" ? "light" : "dark";
  // rolul vine DOAR din middleware (sesiune verificată); antetul din afară e șters acolo
  const r = h.get("x-igo-role");
  const role: Role | null = r === "admin" || r === "user" ? r : null;
  const email = role ? h.get("x-igo-email") : null;
  const start = c.get("igo-trial-start")?.value;
  const used = start ? Math.floor((Date.now() - Date.parse(start)) / 86400000) : 0;
  const trialLeft = Math.max(0, TRIAL_DAYS - used);
  const p = c.get("igo-plan")?.value;
  const previewPlan: PlanState = isPlanState(p) ? p : "trial";
  const view: View = c.get("igo-view")?.value === "user" ? "user" : "admin";
  // firma demo: probă de 14 zile, apoi Start
  const firmPlan: PlanState = trialLeft > 0 ? "trial" : "start";
  const e = effectivePlan(role ? { role, email: email ?? "", firm: "demo", exp: 0 } : null, view, previewPlan, firmPlan);
  return { loc, theme, plan: e.plan, trialLeft, role, email, view, adminView: e.adminView, previewPlan };
}
