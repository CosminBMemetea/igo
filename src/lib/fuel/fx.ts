// Querra Fleet: conversie valutară după cursurile de referință BCE (euro), prin EUR → RON, la data bonului.
// Sursa: https://www.ecb.europa.eu/stats/eurofxref/ (daily / hist-90d / hist). Weekend/sărbători: ultimul curs publicat înainte.
// Cache: memorie per instanță + tabelul fx_rates (dacă există DB) + cache-ul de fetch Next. Feed căzut → null (păstrăm suma originală).
import { and, gte, lte } from "drizzle-orm";
import { db, dbConfigured } from "@/db/client";
import { fxRates } from "@/db/schema";

/** Monede europene acceptate (toate publicate de BCE + EUR). */
export const FX_CURRENCIES = ["EUR", "RON", "PLN", "HUF", "CZK", "BGN", "SEK", "DKK", "CHF", "NOK", "GBP", "ISK", "TRY"] as const;
const KEEP = new Set<string>(FX_CURRENCIES);
const ALIAS: Record<string, string> = { LEI: "RON", LEU: "RON", "€": "EUR", EURO: "EUR", ZL: "PLN", "ZŁ": "PLN", FT: "HUF", "KČ": "CZK", KC: "CZK", LV: "BGN", "ЛВ": "BGN", FR: "CHF", "£": "GBP", KR: "SEK" };
/** „lei”, „€”, „zł” → cod ISO; necunoscut → codul curățat (sau null). */
export function normCur(x: unknown): string | null {
  if (typeof x !== "string" || !x.trim()) return null;
  const u = x.trim().toUpperCase().replace(/\.$/, "");
  return ALIAS[u] ?? (/^[A-Z]{3}$/.test(u) ? u : null);
}
type Rates = Record<string, number>; // 1 EUR = r[cur]
const g = globalThis as unknown as { __fx?: Map<string, Rates>; __fxLoaded?: Set<string> };
const MEM = (g.__fx ??= new Map());
const LOADED = (g.__fxLoaded ??= new Set());

function parse(xml: string): Map<string, Rates> {
  const out = new Map<string, Rates>();
  for (const m of xml.matchAll(/<Cube time=['"](\d{4}-\d{2}-\d{2})['"]>([\s\S]*?)<\/Cube>/g)) {
    const r: Rates = { EUR: 1 };
    for (const c of m[2].matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) if (KEEP.has(c[1])) r[c[1]] = Number(c[2]);
    if (r.RON) out.set(m[1], r);
  }
  return out;
}
const FLIGHT = new Map<string, Promise<boolean>>(), FAILED = new Map<string, number>();
/** o singură descărcare simultană per feed; după eșec nu mai încercăm 10 min (importul nu așteaptă la fiecare rând) */
function feed(kind: "daily" | "hist-90d" | "hist"): Promise<boolean> {
  if (LOADED.has(kind)) return Promise.resolve(true);
  if ((FAILED.get(kind) ?? 0) > Date.now()) return Promise.resolve(false);
  let p = FLIGHT.get(kind);
  if (!p) { p = load(kind).then((ok) => { FLIGHT.delete(kind); if (!ok) FAILED.set(kind, Date.now() + 600_000); return ok; }); FLIGHT.set(kind, p); }
  return p;
}
async function load(kind: "daily" | "hist-90d" | "hist"): Promise<boolean> {
  try {
    const url = `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-${kind}.xml`;
    const r = await fetch(url, { next: { revalidate: kind === "hist" ? 86400 : 3 * 3600 }, signal: AbortSignal.timeout(kind === "hist" ? 12000 : 6000) });
    if (!r.ok) return false;
    const days = parse(await r.text());
    if (!days.size) return false;
    for (const [d, v] of days) MEM.set(d, v);
    LOADED.add(kind);
    if (dbConfigured()) {
      const rows = [...days].flatMap(([date, v]) => Object.entries(v).filter(([c]) => c !== "EUR").map(([cur, perEur]) => ({ date, cur, perEur })));
      for (let i = 0; i < rows.length; i += 500) await db().insert(fxRates).values(rows.slice(i, i + 500)).onConflictDoNothing().catch(() => null);
    }
    return true;
  } catch { return false; }
}
const back = (d: string, n: number) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
/** ultimul curs publicat la sau înainte de `date` (max 10 zile înapoi) */
function pick(date: string): [string, Rates] | null {
  for (let i = 0; i <= 10; i++) { const d = back(date, i), r = MEM.get(d); if (r) return [d, r]; }
  return null;
}
async function fromDb(date: string) {
  if (!dbConfigured()) return;
  try {
    const rows = await db().select().from(fxRates).where(and(gte(fxRates.date, back(date, 10)), lte(fxRates.date, date)));
    for (const x of rows) { const r = MEM.get(x.date) ?? { EUR: 1 }; r[x.cur] = x.perEur; MEM.set(x.date, r); }
  } catch { /* tabel lipsă / DB căzut: mergem la feed */ }
}
export interface Fx { ron: number; rate: number; fxDate: string; cur: string }
/** amount în `cur` la data `date` (YYYY-MM-DD) → lei. RON → identic. Curs indisponibil → null. */
export async function toRon(amount: number, cur0: string | null | undefined, date: string): Promise<Fx | null> {
  const cur = normCur(cur0 ?? "RON") ?? "";
  if (cur === "RON") return { ron: amount, rate: 1, fxDate: date, cur };
  if (!KEEP.has(cur) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ok = (p: [string, Rates] | null) => p && p[1][cur] && p[1].RON;
  let p = pick(date);
  if (!ok(p)) { await fromDb(date); p = pick(date); }
  const age = (Date.now() - Date.parse(date + "T00:00:00Z")) / 864e5;
  if (!ok(p)) { await feed(age < 3 ? "daily" : age < 85 ? "hist-90d" : "hist"); p = pick(date); }
  if (!ok(p) && age < 3) { await feed("hist-90d"); p = pick(date); }
  if (!ok(p)) return null;
  const [d, r] = p!, rate = r.RON / r[cur];
  return { ron: Math.round(amount * rate * 100) / 100, rate: Math.round(rate * 1e6) / 1e6, fxDate: d, cur };
}
