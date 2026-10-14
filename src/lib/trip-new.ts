// „+ Cursă nouă”: estimare km din orașe cunoscute + interpretare text liber („Salonta–Timișoara mâine, Ion”).
import { CITY_COORDS, haversineKm } from "./fleet/data";
import { localNow, isDate } from "./validate";
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// câteva orașe în plus (vestul țării) față de rutele demo
const EXTRA: Record<string, [number, number]> = { Salonta: [46.8, 21.65], "Satu Mare": [47.79, 22.89], Zalău: [47.19, 23.06], Bistrița: [47.13, 24.49], Iași: [47.16, 27.59], Suceava: [47.65, 26.26], Craiova: [44.32, 23.8], Constanța: [44.18, 28.63], Galați: [45.44, 28.05], Bacău: [46.57, 26.91], Reșita: [45.3, 21.89], Hunedoara: [45.75, 22.9], Lugoj: [45.69, 21.9], Beiuș: [46.67, 22.35], Marghita: [47.35, 22.34], Carei: [47.68, 22.47], Mediaș: [46.16, 24.35], Focșani: [45.7, 27.18], Buzău: [45.15, 26.82], "Piatra Neamț": [46.93, 26.37] };
const ALL = { ...CITY_COORDS, ...EXTRA };
export function cityAt(name: string): [number, number] | null { const f = fold(name); const k = Object.keys(ALL).find((x) => fold(x) === f) ?? Object.keys(ALL).find((x) => fold(x).startsWith(f + " ")); return k ? (ALL[k] as [number, number]) : null; }
/** Distanța rutieră aproximativă: linie dreaptă × 1,25, rotunjit la 5 km. Null dacă orașul nu e cunoscut. */
export function estimateKm(from: string, to: string): number | null {
  const a = cityAt(from), b = cityAt(to); if (!a || !b) return null;
  return Math.max(5, Math.round((haversineKm(a, b) * 1.25) / 5) * 5);
}
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export interface Parsed { from?: string; to?: string; date?: string; driver?: string; client?: string; tonnes?: number }
/** Fără AI: „A–B mâine, Ion”, „A - B azi Ion 20t”, „A → B 16.10 Ion pentru Dedeman”. */
export function parseQuick(text: string, today = localNow().slice(0, 10)): Parsed {
  const s = text.trim().replace(/^(?:(?:creeaz[aă]|adaug[aă])\s+(?:o\s+)?curs[aă]\s+)?(?:de\s+la|din|from|z)\s+/iu, ""), out: Parsed = {};
  const m = s.match(/^\s*([\p{L} .'-]+?)\s*(?:[–—→>-]+|\bla\b|\bto\b|\bdo\b)\s*([\p{L} .'-]+?)(?=[,;]|\s+(?:azi|ast[aă]zi|m[aâ]ine|poim[aâ]ine|today|tomorrow|dzi[sś]|jutro|pojutrze|cu|with|pentru|for|dla|șofer|sofer|\d)|$)/iu);
  if (m) { out.from = m[1].trim(); out.to = m[2].trim(); }
  const f = fold(s);
  if (/\b(poimaine|pojutrze)\b/.test(f)) out.date = addDays(today, 2);
  else if (/\b(maine|tomorrow|jutro)\b/.test(f)) out.date = addDays(today, 1);
  else if (/\b(azi|astazi|today|dzis)\b/.test(f)) out.date = today;
  const dm = s.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\b/); if (dm) out.date = `${dm[3] ?? today.slice(0, 4)}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  if (out.date && !isDate(out.date)) delete out.date;
  const tm = s.match(/(\d+(?:[.,]\d+)?)\s*(?:t\b|tone|tonnes|ton)/i); if (tm) out.tonnes = Number(tm[1].replace(",", "."));
  const cm = s.match(/\b(?:pentru|for|dla|client)\s+([\p{L}0-9 .&-]{2,40})/iu); if (cm) out.client = cm[1].trim();
  const parts = s.split(/[,;]/).map((x) => x.trim()).filter(Boolean); const last = parts.length > 1 ? parts[parts.length - 1] : "";
  if (last && !/\d/.test(last) && !/^(pentru|for|dla)\b/i.test(last)) out.driver = last.replace(/^(cu|with|z)\s+/i, "");
  const spokenDriver = s.match(/\b(?:cu|with|șofer|sofer|driver|kierowca)\s+([\p{L} .'-]+?)(?=[,;]|\s+(?:pentru|for|dla|azi|m[aâ]ine|today|tomorrow|\d)|$)/iu);
  if (spokenDriver) out.driver = spokenDriver[1].trim();
  return out;
}
/** Potrivește un nume rostit („Ion”) cu șoferii firmei (prenume / nume, fără diacritice). */
export function matchDriver<T extends { id: string; name: string }>(name: string | undefined, ds: T[]): T | null {
  if (!name) return null; const q = fold(name); if (!q) return null;
  const exact = ds.filter((d) => fold(d.name) === q);
  if (exact.length === 1) return exact[0];
  const matches = ds.filter((d) => fold(d.name).split(" ").includes(q) || fold(d.name).startsWith(q));
  return matches.length === 1 ? matches[0] : null;
}
