import { t, type Locale, type MsgKey } from "./i18n";
import type { TourStep, TourL } from "@/components/DemoTour";
// Povestea unei firme de transport, în 9 pași. sel = elementul evidențiat (primul găsit).
const S: [string, string, string][] = [
  ["dash", "/", ".hero"],
  ["feed", "/feed", ".fstories"],
  ["live", "/live", ".panel"],
  ["trip", "/trips/bh21qrt-15", ".hero"],
  ["replay", "/replay?trip=bh21qrt-15", ".rp-bar"],
  ["alerts", "/alerts", ".alert:has(.badge.bad)"],
  ["import", "/import", ".imp"],
  ["docs", "/documents", "main .list, main .section, main .big"],
  ["driver", "/driver", ".privbox, main .sheet"],
  ["ranking", "/ranking", ".rk-two"],
  ["savings", "/savings", "main .big"],
];
// desktop: suprascrieri pe pas — zona evidențiată (uniunea selectorilor) și cardul „andocat” într-un element
const OV: Record<string, Pick<TourStep, "area" | "dock">> = { replay: { area: [".rp-top", ".rp-hud", ".rp-bar"], dock: ".rp-panel" } };
export const tourSteps = (loc: Locale): TourStep[] => S.map(([k, path, sel]) => ({ path, sel, ...OV[k], title: t(loc, `tour.${k}.t` as MsgKey), body: t(loc, `tour.${k}.b` as MsgKey) }));
export const tourLabels = (loc: Locale): TourL => Object.fromEntries((["next", "back", "skip", "done", "of", "trial", "contact", "restart"] as const).map((k) => [k, t(loc, `tour.${k}` as MsgKey)])) as unknown as TourL;
