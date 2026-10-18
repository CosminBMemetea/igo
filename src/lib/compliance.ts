import { docStatus, type DocStatus } from "./docs";
import { isDate } from "./validate";

export const LEGAL_CATEGORIES = ["M1", "M2", "M3", "N1", "N2", "N3", "other"] as const;
export const EURO_CLASSES = ["0", "1", "2", "3", "4", "5", "6"] as const;
export const PROPULSIONS = ["diesel", "petrol", "hybrid", "electric", "other"] as const;
export interface VehicleCompliance {
  category: typeof LEGAL_CATEGORIES[number] | null;
  mtmaKg: number | null;
  seats: number | null;
  euro: typeof EURO_CLASSES[number] | null;
  propulsion: typeof PROPULSIONS[number] | null;
  country: string | null;
}
export type RoadRegime = "vignette" | "tollro" | "unknown";
/** Current classification only, not a historical tariff engine or proof of payment.
 * Sources checked 2026-10-18: portal.etoll.ro/web/guest/rotoll and Legea 226/2023 art. 4, 12.
 * No assumptions from display kind, cargo weight, EURO or number plate. */
export function roadRegime(p?: VehicleCompliance | null): RoadRegime {
  if (!p?.category || p.category === "other") return "unknown";
  if (p.category.startsWith("M")) return "vignette";
  if (!p.mtmaKg || !Number.isFinite(p.mtmaKg)) return "unknown";
  // Contradictory registration data must never produce a positive result.
  if ((p.category === "N1" && p.mtmaKg > 3500) || (p.category === "N2" && (p.mtmaKg <= 3500 || p.mtmaKg > 12000)) || (p.category === "N3" && p.mtmaKg <= 12000)) return "unknown";
  return p.mtmaKg > 3500 ? "tollro" : "vignette";
}
export function parseCompliance(raw: Record<string, unknown>): VehicleCompliance | null {
  const pick = <T extends string>(v: unknown, choices: readonly T[]): T | null | undefined => v == null || v === "" ? null : choices.includes(v as T) ? v as T : undefined;
  const num = (v: unknown, max: number) => v == null || v === "" ? null : /^\d+$/.test(String(v)) && +String(v) > 0 && +String(v) <= max ? +String(v) : undefined;
  const category = pick(raw.category, LEGAL_CATEGORIES), euro = pick(raw.euro, EURO_CLASSES), propulsion = pick(raw.propulsion, PROPULSIONS);
  const mtmaKg = num(raw.mtmaKg, 200000), seats = num(raw.seats, 200);
  const country = raw.country == null || raw.country === "" ? null : String(raw.country).trim().toUpperCase();
  if ([category, euro, propulsion, mtmaKg, seats].includes(undefined) || (country && !/^[A-Z]{2}$/.test(country))) return null;
  if (category === "N1" && mtmaKg != null && mtmaKg > 3500) return null;
  if (category === "N2" && mtmaKg != null && (mtmaKg <= 3500 || mtmaKg > 12000)) return null;
  if (category === "N3" && mtmaKg != null && mtmaKg <= 12000) return null;
  if (category === "M1" && seats != null && seats > 9) return null;
  if ((category === "M2" || category === "M3") && seats != null && seats <= 9) return null;
  return { category: category!, mtmaKg: mtmaKg!, seats: seats!, euro: euro!, propulsion: propulsion!, country };
}

export interface ComplianceDoc { id: string; type: string; expires: string | null; validFrom?: string | null; fileId?: string | null }
export type ComplianceState = DocStatus | "missing" | "unknown" | "future" | "not-applicable";
export interface ComplianceItem { type: string; state: ComplianceState; doc?: ComplianceDoc; required: boolean }
/** Pick coverage for today, not the newest/farthest renewal that has not started yet. */
export function currentDocument<T extends ComplianceDoc>(docs: T[], today: string): T | undefined {
  const valid = docs.filter(d => d.expires && isDate(d.expires) && (!d.validFrom || (isDate(d.validFrom) && d.validFrom <= d.expires)));
  const started = valid.filter(d => !d.validFrom || d.validFrom <= today).sort((a, b) => b.expires!.localeCompare(a.expires!) || a.id.localeCompare(b.id));
  return started.find(d => d.expires! >= today) ?? valid.filter(d => d.validFrom && d.validFrom > today).sort((a, b) => a.validFrom!.localeCompare(b.validFrom!) || a.id.localeCompare(b.id))[0] ?? started[0];
}
export function documentState(d: ComplianceDoc | undefined, today: string): ComplianceState {
  if (!d) return "missing";
  if (!d.expires || !isDate(d.expires) || (d.validFrom && (!isDate(d.validFrom) || d.validFrom > d.expires))) return "unknown";
  if (d.validFrom && d.validFrom > today) return "future";
  return docStatus(d.expires, today).status;
}
/** RCA/ITP baseline for road motor vehicles; special registrations require manual review. */
export function vehicleCompliance(p: VehicleCompliance | null | undefined, docs: ComplianceDoc[], today: string): ComplianceItem[] {
  const regime = roadRegime(p);
  const item = (type: string, required: boolean): ComplianceItem => {
    const candidates = docs.filter(d => d.type === type), doc = currentDocument(candidates, today);
    return { type, required, doc, state: doc ? documentState(doc, today) : candidates.length ? "unknown" : "missing" };
  };
  const rows: ComplianceItem[] = [item("rca", true), item("itp", true)];
  rows.push(regime === "vignette" ? item("vignette", true) : { type: "vignette", state: regime === "tollro" ? "not-applicable" : "unknown", required: false });
  if (regime === "tollro") rows.push({ type: "tollro", state: "unknown", required: true });
  if (!p?.category || p.category === "other" || !p.country || !p.mtmaKg || (p.category.startsWith("M") && !p.seats) || !p.propulsion || (p.propulsion !== "electric" && !p.euro)) rows.push({ type: "classification", state: "unknown", required: true });
  for (const type of new Set(docs.map(d => d.type))) if (!["rca", "itp", "vignette"].includes(type)) rows.push(item(type, false));
  return rows;
}
export function needsAttention(i: ComplianceItem) { return !["valid", "not-applicable"].includes(i.state); }
