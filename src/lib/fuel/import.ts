// Querra Fleet: importul CSV pe server — parsare, potrivire card/plăcuță → camion, deduplicare, salvare.
import { createHash } from "node:crypto";
import { parseFuelCsv, parseCsv, headerSig, txKey, SOURCE_NAME, type FuelRow, type Mapping } from "./parse";
import { cardAt, plateKey } from "./cards";
import { toRon, normCur, type Fx } from "./fx";
import { isRon } from "./lei";
import { newId, type NewFuelTx, type Store } from "../store/types";

export const MAX_CSV_BYTES = 3 * 1024 * 1024;
export const hashRow = (r: FuelRow) => createHash("sha256").update(txKey(r)).digest("base64url").slice(0, 32);

export async function analyze(s: Store, firmId: string, text: string, mapping?: Mapping, assign: Record<string, string> = {}) {
  let saved = false;
  if (!mapping) {
    const m = await s.savedMapping(firmId, headerSig(parseCsv(text).headers)).catch(() => null);
    if (m) { mapping = m as Mapping; saved = true; }
  }
  const p = parseFuelCsv(text, mapping);
  const [trucks, cards, existing] = await Promise.all([s.trucks(firmId), s.fuelCards(firmId), s.fuel(firmId, { limit: 50000 })]);
  const byPlate = new Map(trucks.map((t) => [plateKey(t.plate)!, t.id]));
  const known = new Set(existing.map((x) => x.hash));
  const conflicts: { card: string; at: string; plate: string; expected: string }[] = [];
  const rows = p.rows.map((r) => {
    const hash = hashRow(r);
    const fromCard = r.card ? cardAt(cards, r.card, r.at)?.truckId : undefined;
    const fromPlate = byPlate.get(plateKey(r.plate));
    if (!known.has(hash) && fromCard && fromPlate && fromCard !== fromPlate) conflicts.push({ card: r.card!, at: r.at, plate: r.plate!, expected: trucks.find((t) => t.id === fromCard)?.plate ?? fromCard });
    // Preview choices cover only unresolved rows in this file. They never rewrite card history.
    const chosen = r.card && Object.hasOwn(assign, r.card) ? assign[r.card] : null;
    const truckId = fromCard ?? fromPlate ?? (trucks.some((t) => t.id === chosen && !t.archivedAt) ? chosen : null);
    return { r, truckId, hash };
  });
  const seen = new Set<string>();
  let dupes = 0;
  for (const x of rows) { if (known.has(x.hash) || seen.has(x.hash)) dupes++; seen.add(x.hash); }
  const unknownMap = new Map<string, { card: string | null; plate: string | null; n: number; litres: number }>();
  for (const x of rows) if (!x.truckId) {
    const k = x.r.card ?? `p:${x.r.plate}`;
    const u = unknownMap.get(k) ?? { card: x.r.card, plate: x.r.plate, n: 0, litres: 0 };
    u.n++; u.litres = Math.round((u.litres + x.r.litres) * 10) / 10; unknownMap.set(k, u);
  }
  const ats = p.rows.map((r) => r.at).sort();
  // monede străine: curs BCE la data fiecărui rând (prin EUR → RON); fără curs → păstrăm suma originală și avertizăm
  const fx = new Map<number, Fx | null>();
  await Promise.all(rows.map(async (x, i) => { if (x.r.amount != null && !isRon(x.r.currency)) fx.set(i, await toRon(x.r.amount, x.r.currency, x.r.at.slice(0, 10))); }));
  const fxSum = new Map<string, { cur: string; n: number; rate: number | null; fxDate: string | null; missing: number; peg?: boolean }>();
  for (const [i, f] of fx) { const cur = normCur(rows[i].r.currency) ?? String(rows[i].r.currency); const g = fxSum.get(cur) ?? { cur, n: 0, rate: null, fxDate: null, missing: 0 }; g.n++; if (f) { if (!g.fxDate || f.fxDate > g.fxDate) { g.rate = f.rate; g.fxDate = f.fxDate; } if (f.peg) g.peg = true; } else g.missing++; fxSum.set(cur, g); }
  return {
    parsed: p, rows, fxRows: fx,
    summary: {
      source: p.source, sourceName: SOURCE_NAME[p.source], headers: p.headers, mapping: p.mapping, confident: p.confident || (saved && !p.missing.length), missing: p.missing,
      conflicts, total: p.total, valid: p.rows.length, skipped: p.skipped, preview: p.preview, errors: p.errors, delimiter: p.delimiter, savedMapping: saved, newRows: p.rows.length - dupes, dupes, fx: [...fxSum.values()],
      future: p.rows.filter((r) => r.at.slice(0, 10) > new Date(Date.now() + 86400000).toISOString().slice(0, 10)).length, matched: rows.filter((x) => x.truckId).length, unknown: [...unknownMap.values()], from: ats[0] ?? null, to: ats[ats.length - 1] ?? null,
      trucks: trucks.filter((t) => !t.archivedAt).map((t) => ({ id: t.id, plate: t.plate })),
    },
  };
}
export type Summary = Awaited<ReturnType<typeof analyze>>["summary"];

const fxCols = (cur: string | null, f: Fx | null | undefined) => (f ? { currency: f.cur, amountRon: f.ron, fxRate: f.rate, fxDate: f.fxDate } : { currency: normCur(cur) ?? cur, amountRon: null, fxRate: null, fxDate: null });
export async function commit(s: Store, firmId: string, text: string, filename: string, mapping?: Mapping, assign: Record<string, string> = {}) {
  const trucks = new Set((await s.trucks(firmId)).map((t) => t.id));
  const clean = Object.fromEntries(Object.entries(assign).filter(([, v]) => trucks.has(v)));
  const a = await analyze(s, firmId, text, mapping, clean);
  if (a.parsed.missing.length || a.summary.conflicts.length) return { ok: false as const, summary: a.summary };
  const imp = { id: newId("m") };
  const rows: NewFuelTx[] = a.rows.map(({ r, truckId, hash }, i) => ({ ...fxCols(r.currency, a.fxRows.get(i)), truckId, source: a.parsed.source, importId: imp.id, hash, card: r.card, plate: r.plate, at: r.at, station: r.station, country: r.country, product: r.product, litres: r.litres, amount: r.amount, odometer: r.odometer, lat: r.lat, lng: r.lng, userId: null, photoName: null, photoSize: null, aiRead: false }));
  const res = await s.addFuel(firmId, rows);
  await s.saveMapping(firmId, headerSig(a.parsed.headers), a.parsed.mapping).catch(() => {});
  await s.addImport(firmId, { id: imp.id, source: a.parsed.source, filename: filename.slice(0, 120), rows: a.parsed.total, added: res.added, dupes: res.dupes, skipped: a.parsed.total - a.parsed.rows.length });
  return { ok: true as const, summary: a.summary, added: res.added, dupes: res.dupes, importId: imp.id, unknown: a.summary.unknown.filter((u) => !(u.card && clean[u.card])).length };
}
