import { ro, type MsgKey } from "./ro";
import { en } from "./en";
import { pl } from "./pl";
import { pluralForm } from "./plural";

export type Locale = "ro" | "en" | "pl";
export const LOCALES: Locale[] = ["ro", "en", "pl"]; // order used by tri() for "ro|en|pl" strings — do not reorder
export const DEFAULT_LOCALE: Locale = "pl";
/** UI listing / preselect order. Separate from LOCALES so tri() stays correct. */
export const LOCALE_OPTIONS: Locale[] = ["pl", "ro", "en"];
export const LOCALE_COOKIE = "igo-locale";
export const CATALOGS: Record<Locale, Record<MsgKey, string>> = { ro, en, pl };
export type { MsgKey };

export type Vars = Record<string, string | number>;
/** Înlocuiește {k} cu valoarea și {k:unu/câțiva/mulți} cu „N formă” (plural CLDR pe limba dată). */
export function fill(loc: Locale, s: string, vars: Vars): string {
  return s.replace(/\{(\w+)(?::([^}]+))?\}/g, (m, k, forms?: string) => {
    if (!(k in vars)) return m;
    const v = vars[k];
    return forms ? `${typeof v === "number" ? fmtNum(loc, v) : v} ${pluralForm(loc, typeof v === "number" ? v : Number(String(v).replace(/[^\d-]/g, "")), forms.replace(/\//g, "|"))}` : String(v);
  });
}
export function t(loc: Locale, key: MsgKey, vars?: Vars): string {
  const s = CATALOGS[loc][key] ?? CATALOGS.ro[key] ?? key;
  return vars ? fill(loc, s, vars) : s;
}
/** „N formă” dintr-un șir inline „ro1/ro2/ro3|en1/en2|pl1/pl2/pl3” (aceeași ordine ca tri). */
export const countTri = (loc: Locale, n: number, s: string) => `${fmtNum(loc, n)} ${pluralForm(loc, n, tri(loc, s).replace(/\//g, "|"))}`;
export const isLocale = (x: unknown): x is Locale => x === "ro" || x === "en" || x === "pl";
export const localeOrDefault = (x: unknown): Locale => (isLocale(x) ? x : DEFAULT_LOCALE);
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}
/** Forma de plural: cheia are „unu|câțiva|mulți” (ro: 1 cursă, 2 curse, 20 de curse). */
export function plural(loc: Locale, n: number, key: MsgKey): string {
  return `${fmtNumP(loc, n)} ${pluralForm(loc, n, t(loc, key))}`;
}
const fmtNumP = (loc: Locale, n: number) => fmtNum(loc, n);
/** Text inline „ro|en|pl” (folosit pentru matricea de funcții din features.ts). */
export const tri = (loc: Locale, s: string) => s.split("|")[LOCALES.indexOf(loc)] ?? s.split("|")[0];

// ---------- formatare manuală (identică pe server și în browser, fără diferențe Intl) ----------
const SEP: Record<Locale, { th: string; dec: string }> = { ro: { th: ".", dec: "," }, pl: { th: "\u00a0", dec: "," }, en: { th: ",", dec: "." } };
/** Litri: până la 2 zecimale, fără zerouri inutile (1,5 · 412,25 · 410). */
export const fmtLitres = (loc: Locale, n: number) => { const r = Math.round(n * 100) / 100; return fmtNum(loc, r, r % 1 === 0 ? 0 : Math.round(r * 10) === r * 10 ? 1 : 2); };
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
