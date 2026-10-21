import { clipChars } from "@/lib/validate";
import { normalizeCard, validCardId } from "./cards";
// Querra Fleet: import CSV card carburant. Pur (fără I/O), testat în smoke:fuel.
// Detectează separatorul, formatul (DKV, OMV/Routex, MOL, Shell, E100, generic) și coloanele; numere și date RO/PL/EN.

export type Source = "dkv" | "omv" | "mol" | "shell" | "e100" | "generic";
export const SOURCES: Source[] = ["dkv", "omv", "mol", "shell", "e100", "generic"];
export const SOURCE_NAME: Record<Source, string> = { dkv: "DKV", omv: "OMV / Routex", mol: "MOL", shell: "Shell Card", e100: "E100", generic: "CSV" };
export type Field = "date" | "time" | "card" | "plate" | "station" | "country" | "product" | "litres" | "amount" | "currency" | "odometer" | "lat" | "lng";
export const FIELDS: Field[] = ["date", "time", "card", "plate", "station", "country", "product", "litres", "amount", "currency", "odometer", "lat", "lng"];
export const REQUIRED: Field[] = ["date", "litres"];
export type Mapping = Partial<Record<Field, number>>;

// ---------- CSV ----------
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  let best = ",", score = -1;
  for (const d of [";", ",", "\t", "|"]) {
    // cel mai frecvent număr de câmpuri (>1), ponderat cu câte linii îl au; antetul contează dublu. Rândurile stricate nu mai schimbă separatorul.
    const counts = lines.map((l) => splitLine(l, d).length), freq = new Map<number, number>();
    counts.forEach((c, i) => { if (c > 1) freq.set(c, (freq.get(c) ?? 0) + (i === 0 ? 2 : 1)); });
    const [n, f] = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [1, 0];
    const s = f * 100 + n;
    if (s > score) { score = s; best = d; }
  }
  return best;
}
function splitLine(line: string, d: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === d) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
export function parseCsv(text: string): { delimiter: string; headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  // ghilimele pe mai multe linii: unim liniile până se închid ghilimelele
  const raw = clean.split(/\r?\n/), lines: string[] = [];
  for (let i = 0, buf = ""; i < raw.length; i++) { buf = buf ? `${buf}\n${raw[i]}` : raw[i]; if ((buf.match(/"/g)?.length ?? 0) % 2 === 0) { if (buf.trim()) lines.push(buf); buf = ""; } }
  // antetul = prima linie cu cel puțin 3 câmpuri (unele exporturi au titlu deasupra)
  const all = lines.map((l) => splitLine(l, delimiter));
  const h = Math.max(0, all.findIndex((r) => r.filter(Boolean).length >= 3));
  return { delimiter, headers: all[h] ?? [], rows: all.slice(h + 1).filter((r) => r.some(Boolean)) };
}

// ---------- antete ----------
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[łŁ]/g, "l").replace(/[^a-z0-9]+/g, " ").trim();
/** Sinonime pe câmp (EN/RO/PL/DE/HU), deja normalizate. Ordinea contează: primele sunt cele mai sigure. */
const SYN: Record<Field, string[]> = {
  date: ["transaction date", "data tranzactiei", "data tranzactie", "data", "date", "datum", "data transakcji", "tranzakcio datuma", "datum zeit", "date time", "datetime", "ziua", "zi", "dzien"],
  time: ["time", "ora", "uhrzeit", "godzina", "czas", "zeit", "transaction time"],
  card: ["card number", "card no", "card", "nr card", "numar card", "kartennummer", "karta", "numer karty", "nr karty", "kartyaszam", "pan"],
  plate: ["nr auto", "nr. auto", "numar auto", "număr auto", "nr masina", "licence plate", "license plate", "vehicle registration", "registration number", "registration", "nr inmatriculare", "numar inmatriculare", "inmatriculare", "kennzeichen", "nr rejestracyjny", "numer rejestracyjny", "rendszam", "plate", "vehicle", "masina", "camion", "auto", "pojazd"],
  station: ["locatie", "locatia", "locație", "locaţie", "localitate", "service station", "station name", "site name", "statie", "statia", "station", "tankstelle", "stacja", "location", "site", "kut"],
  country: ["country", "tara", "land", "kraj", "orszag"],
  product: ["product", "produs", "produkt", "termek", "article", "goods"],
  litres: ["quantity", "volume l", "volume", "cantitate l", "cantitate", "litri", "litres", "liters", "menge", "ilosc", "ilosc l", "mennyiseg", "qty", "cant", "l"],
  amount: ["gross amount", "amount gross", "valoare bruta", "suma", "valoare", "kwota brutto", "kwota", "bruttobetrag", "betrag", "brutto osszeg", "osszeg", "amount", "total"],
  currency: ["currency", "moneda", "valuta", "wahrung", "waluta", "penznem"],
  odometer: ["mileage", "odometer", "km bord", "kilometraj", "km", "kilometerstand", "przebieg", "licznik", "kilometerora"],
  lat: ["lat", "latitude", "szerokosc"],
  lng: ["lon", "lng", "longitude", "dlugosc"],
};
export function autoMap(headers: string[]): Mapping {
  const hs = headers.map(norm), m: Mapping = {}, used = new Set<number>();
  for (const f of FIELDS) {
    for (const syn of SYN[f]) {
      const i = hs.findIndex((h, k) => !used.has(k) && (h === syn || (syn.length > 3 && h.startsWith(syn + " "))));
      if (i >= 0) { m[f] = i; used.add(i); break; }
    }
  }
  return m;
}
/** Semnături (antete normalizate care trebuie să existe) pentru exporturile cunoscute. */
const SIG: [Source, string[]][] = [
  ["dkv", ["card number", "licence plate", "service station", "gross amount"]],
  ["omv", ["card no", "vehicle registration", "volume l", "amount gross"]],
  ["mol", ["nr card", "nr inmatriculare", "cantitate l", "valoare bruta"]],
  ["shell", ["card number", "registration number", "site name", "gross amount"]],
  ["e100", ["karta", "nr rejestracyjny", "ilosc", "kwota brutto"]],
];
export function detectSource(headers: string[]): Source {
  const hs = new Set(headers.map(norm));
  return SIG.find(([, sig]) => sig.every((s) => hs.has(s)))?.[0] ?? "generic";
}

// ---------- numere ----------
/** Separatorul zecimal al unei coloane, din toate valorile ei. */
export function decimalSep(values: string[], delimiter: string): "," | "." {
  let comma = 0, dot = 0;
  for (const raw of values) {
    const v = raw.replace(/[\s\u00a0']/g, "").replace(/[^\d.,-]/g, "");
    const lc = v.lastIndexOf(","), ld = v.lastIndexOf(".");
    if (lc >= 0 && ld >= 0) { if (lc > ld) comma += 5; else dot += 5; continue; }
    if (lc >= 0) { if (v.length - lc - 1 !== 3 || (v.match(/,/g)!.length === 1 && /^-?0,/.test(v))) comma += 2; else dot += 0.1; }
    if (ld >= 0) { if (v.length - ld - 1 !== 3 || (v.match(/\./g)!.length === 1 && /^-?0\./.test(v))) dot += 2; else comma += 0.1; }
  }
  if (comma === dot) return delimiter === ";" ? "," : ".";
  return comma > dot ? "," : ".";
}
export function parseNum(raw: string | undefined, dec: "," | "."): number | null {
  if (raw == null) return null;
  let v = raw.replace(/[\s\u00a0']/g, "").replace(/[^\d.,-]/g, "");
  if (!v || v === "-") return null;
  v = dec === "," ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------- date ----------
export type DateOrder = "ymd" | "dmy" | "mdy";
/** Ordinea zi/lună pentru o coloană: dacă vreo valoare are prima parte > 12 → zi întâi; dacă a doua > 12 → lună întâi; altfel zi întâi (RO/PL/UE). */
export function dateOrder(values: string[]): DateOrder {
  let dmy = false, mdy = false;
  for (const v of values) {
    if (/^\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(v)) return "ymd";
    const m = /^\s*(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/.exec(v);
    if (!m) continue;
    if (+m[1] > 12) dmy = true; if (+m[2] > 12) mdy = true;
  }
  return mdy && !dmy ? "mdy" : "dmy";
}
const p2 = (n: number) => String(n).padStart(2, "0");
/** → „YYYY-MM-DDTHH:MM” (ora locală, așa cum apare în export). */
export function parseDateTime(dateRaw: string | undefined, timeRaw: string | undefined, order: DateOrder): string | null {
  if (!dateRaw) return null;
  const s = dateRaw.trim();
  let y: number, mo: number, d: number, rest: string;
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(.*)$/.exec(s);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
  else {
    m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})(.*)$/.exec(s);
    if (!m) return null;
    const a = +m[1], b = +m[2]; y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    [d, mo] = order === "mdy" ? [b, a] : [a, b]; rest = m[4];
  }
  const tm = /(\d{1,2})[:.](\d{2})/.exec(timeRaw?.trim() || rest) ;
  let hh = tm ? +tm[1] : 0; const mm = tm ? +tm[2] : 0;
  if (/pm/i.test(timeRaw || rest) && hh < 12) hh += 12;
  if (/am/i.test(timeRaw || rest) && hh === 12) hh = 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return `${y}-${p2(mo)}-${p2(d)}T${p2(hh)}:${p2(mm)}`;
}

// ---------- rânduri ----------
/** ş/ţ cu sedilă (Windows-1250, Excel vechi) → ș/ț corecte: „Florești”, nu „Floreşti”. */
export const roFix = (s: string) => s.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");
export interface FuelRow { at: string; card: string | null; plate: string | null; station: string; country: string | null; product: string | null; litres: number; amount: number | null; currency: string | null; odometer: number | null; lat: number | null; lng: number | null }
export type SkipReason = "date" | "litres" | "nonfuel" | "id";
const NON_FUEL = /adblue|ad blue|toll|maut|peaj|vignette|viniet|rovinieta|winieta|myto|wash|spalat|myjnia|oil|ulei|olej|parking|parcare|parking|service|serwis|shop|magazin|food/i;
export interface ParseResult { source: Source; delimiter: string; headers: string[]; mapping: Mapping; confident: boolean; missing: Field[]; rows: FuelRow[]; skipped: Record<SkipReason, number>; total: number; preview: string[][]; errors: RowError[] }
export interface RowError { line: number; reason: SkipReason; value: string }
/** Semnătura antetului (pentru maparea salvată per firmă). */
export const headerSig = (h: string[]) => h.map((x) => norm(x)).join("|").slice(0, 400);
export const cleanCard = (s: string | undefined) => normalizeCard(s ?? "") || null;

export function parseFuelCsv(text: string, override?: Mapping): ParseResult {
  const { delimiter, headers, rows } = parseCsv(text);
  const source = detectSource(headers);
  const auto = autoMap(headers);
  const mapping: Mapping = override ? Object.fromEntries(Object.entries(override).filter(([, v]) => typeof v === "number" && v >= 0 && v < headers.length)) : auto;
  const missing = REQUIRED.filter((f) => mapping[f] == null);
  const idOk = mapping.card != null || mapping.plate != null;
  if (!idOk) missing.push("card");
  const col = (f: Field) => (mapping[f] != null ? rows.map((r) => r[mapping[f]!] ?? "") : []);
  const dec: Partial<Record<Field, "," | ".">> = {};
  for (const f of ["litres", "amount", "odometer", "lat", "lng"] as Field[]) dec[f] = decimalSep(col(f), delimiter);
  const order = dateOrder(col("date"));
  const skipped: Record<SkipReason, number> = { date: 0, litres: 0, nonfuel: 0, id: 0 };
  const out: FuelRow[] = [];
  const get = (r: string[], f: Field) => (mapping[f] != null ? r[mapping[f]!] : undefined);
  const num = (r: string[], f: Field) => parseNum(get(r, f), dec[f] ?? ".");
  const errors: RowError[] = [];
  const bad = (i: number, reason: SkipReason, value: string | undefined) => { skipped[reason]++; if (errors.length < 50) errors.push({ line: i + 2, reason, value: (value ?? "").slice(0, 40) }); };
  if (!missing.length) for (const [i, r] of rows.entries()) {
    const product = get(r, "product")?.trim() || null;
    if (product && NON_FUEL.test(norm(product)) && !/diesel|motorina|olej napedowy|gasoil|dizel|on eko/.test(norm(product))) { bad(i, "nonfuel", product); continue; }
    const at = parseDateTime(get(r, "date"), get(r, "time"), order);
    if (!at) { bad(i, "date", [get(r, "date"), get(r, "time")].filter(Boolean).join(" ")); continue; }
    const litres = num(r, "litres");
    if (litres == null || litres <= 0 || litres > 5000) { bad(i, "litres", get(r, "litres")); continue; }
    const card = cleanCard(get(r, "card")), plate = get(r, "plate")?.trim().toUpperCase() || null;
    if (card && !validCardId(card)) { bad(i, "id", get(r, "card")); continue; }
    if (!card && !plate) { bad(i, "id", ""); continue; }
    const odo = num(r, "odometer");
    out.push({ at, card, plate, station: clipChars(roFix(get(r, "station") ?? ""), 120), country: get(r, "country")?.trim().slice(0, 3).toUpperCase() || null, product, litres: Math.round(litres * 100) / 100, amount: num(r, "amount"), currency: get(r, "currency")?.trim().toUpperCase().slice(0, 3) || null, odometer: odo != null && odo > 0 && odo < 10_000_000 ? Math.round(odo) : null, lat: num(r, "lat"), lng: num(r, "lng") });
  }
  const confident = !missing.length && (source !== "generic" || (mapping.date != null && mapping.litres != null && (mapping.card != null || mapping.plate != null) && out.length >= Math.max(1, rows.length * 0.8)));
  return { source, delimiter, headers, mapping, confident, missing, rows: out, skipped, total: rows.length, preview: rows.slice(0, 5), errors };
}

/** Textul canonic pentru deduplicare (hash-uit pe server): același card, minut, litri, sumă, stație. */
export const txKey = (r: Pick<FuelRow, "card" | "plate" | "at" | "litres" | "amount" | "station">) =>
  [r.card ?? `p:${(r.plate ?? "").replace(/\s/g, "")}`, r.at, r.litres.toFixed(2), r.amount == null ? "" : r.amount.toFixed(2), norm(r.station)].join("|");
