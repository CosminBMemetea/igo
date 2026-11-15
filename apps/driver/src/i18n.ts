import { createContext, useContext } from "react";
export type Loc = "ro" | "en" | "pl";
export const LOCS: Loc[] = ["ro", "en", "pl"]; // order used by tri() for "RO|EN|PL" strings — do not reorder
export const DEFAULT_LOCALE: Loc = "pl";
export const LOC_OPTIONS: Loc[] = ["pl", "ro", "en"];
export function deviceLoc(): Loc {
  try {
    const l = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (l.startsWith("pl")) return "pl";
    if (l.startsWith("en")) return "en";
    if (l.startsWith("ro")) return "ro";
    return DEFAULT_LOCALE;
  } catch { return DEFAULT_LOCALE; }
}
/** "RO|EN|PL" → the text for the locale (same convention as the web tri()). */
export function tri(loc: Loc, s: string) { const p = s.split("|"); return p[LOCS.indexOf(loc)] ?? p[0]; }
/** Plural forms: RO "one/few/many(de)", EN "one/other", PL "one/few/many". */
export function countTri(loc: Loc, n: number, s: string) {
  const forms = tri(loc, s).split("/");
  const k = loc === "en" ? (n === 1 ? 0 : 1)
    : loc === "pl" ? (n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2)
    : (n === 1 ? 0 : n === 0 || (n % 100 > 0 && n % 100 < 20) ? 1 : 2);
  return `${n} ${forms[Math.min(k, forms.length - 1)]}`;
}
const TAG: Record<Loc, string> = { ro: "ro-RO", en: "en-GB", pl: "pl-PL" };
export const tag = (loc: Loc) => TAG[loc];
export function fmtDate(loc: Loc, day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(TAG[loc], { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : day;
}
export function fmtTime(loc: Loc, iso: string) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString(TAG[loc], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }) : "";
}
export function fmtDateTime(loc: Loc, iso: string) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(TAG[loc], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }) : "";
}
export const LocContext = createContext<Loc>(DEFAULT_LOCALE);
export function useT() { const loc = useContext(LocContext); return { loc, t: (s: string) => tri(loc, s) }; }
