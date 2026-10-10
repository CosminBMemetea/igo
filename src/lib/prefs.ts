import { cookies, headers } from "next/headers";
import { isLocale, pickLocale, type Locale } from "./i18n";
import { TRIAL_DAYS, isPlanState, type PlanState } from "./features";

export interface Prefs { loc: Locale; theme: "dark" | "light"; plan: PlanState; trialLeft: number }
export function getPrefs(): Prefs {
  const c = cookies();
  const l = c.get("igo-locale")?.value;
  const loc = isLocale(l) ? l : pickLocale(headers().get("accept-language"));
  const theme = c.get("igo-theme")?.value === "light" ? "light" : "dark";
  const start = c.get("igo-trial-start")?.value;
  const used = start ? Math.floor((Date.now() - Date.parse(start)) / 86400000) : 0;
  const trialLeft = Math.max(0, TRIAL_DAYS - used);
  const p = c.get("igo-plan")?.value;
  let plan: PlanState = isPlanState(p) ? p : "trial";
  if (plan === "trial" && trialLeft === 0) plan = "start";
  return { loc, theme, plan, trialLeft };
}
