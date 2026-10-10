import { ro, type MsgKey } from "./ro";
import { en } from "./en";
import { pl } from "./pl";

export type Locale = "ro" | "en" | "pl";
export const LOCALES: Locale[] = ["ro", "en", "pl"];
export const LOCALE_COOKIE = "igo-locale";
export const CATALOGS: Record<Locale, Record<MsgKey, string>> = { ro, en, pl };
export type { MsgKey };

export type Vars = Record<string, string | number>;
export function t(loc: Locale, key: MsgKey, vars?: Vars): string {
  const s = CATALOGS[loc][key] ?? CATALOGS.ro[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}
export const isLocale = (x: unknown): x is Locale => x === "ro" || x === "en" || x === "pl";
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return "ro";
}
/** Text inline „ro|en|pl” (folosit pentru matricea de funcții din features.ts). */
export const tri = (loc: Locale, s: string) => s.split("|")[LOCALES.indexOf(loc)] ?? s.split("|")[0];

// ---------- formatare manuală (identică pe server și în browser, fără diferențe Intl) ----------
const SEP: Record<Locale, { th: string; dec: string }> = { ro: { th: ".", dec: "," }, pl: { th: "\u00a0", dec: "," }, en: { th: ",", dec: "." } };
export function fmtNum(loc: Locale, n: number, d = 0): string {
  const [i, f] = Math.abs(n).toFixed(d).split(".");
  const grouped = loc === "pl" && i.length <= 4 ? i : i.replace(/\B(?=(\d{3})+(?!\d))/g, SEP[loc].th);
  const neg = n < 0 && Number(Math.abs(n).toFixed(d)) !== 0;
  return (neg ? "−" : "") + grouped + (f ? SEP[loc].dec + f : "");
}
export function fmtMoney(loc: Locale, n: number, d = 0): string {
  const v = fmtNum(loc, n, d);
  return loc === "en" ? `RON ${v}` : loc === "pl" ? `${v} RON` : `${v} lei`;
}
export function fmtPct(loc: Locale, frac: number, d = 1): string {
  return `${fmtNum(loc, frac * 100, d)}%`;
}
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(loc: Locale, iso: string, withYear = false): string {
  const [d, h] = iso.split("T");
  const [y, m, day] = d.split("-");
  const date = loc === "en" ? `${+day} ${MONTHS_EN[+m - 1]}${withYear ? " " + y : ""}` : `${day}.${m}${withYear ? "." + y : ""}`;
  return h ? `${date} ${h.slice(0, 5)}` : date;
}
