import { parseCompliance, type VehicleCompliance } from "./compliance";
import type { TruckRow } from "./store/types";
export const PROFILE_HEADERS = ["plate", "category", "mtmaKg", "seats", "euro", "propulsion", "country"] as const;
export const csvCell = (v: unknown) => `"${String(v ?? "").replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""')}"`;
export const csv = (rows: unknown[][]) => "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
/** Small strict RFC4180 reader: quoted cells, BOM, CRLF; invalid quoting rejected. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; continue; }
    if (c === '"') { if (cell || closed) throw new Error("csv"); quoted = true; }
    else if (c === ",") { row.push(cell); cell = ""; closed = false; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; closed = false; }
    else { if (closed) throw new Error("csv"); cell += c; }
  }
  if (quoted) throw new Error("csv");
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export interface ComplianceUpdate { id: string; plate: string; previous: VehicleCompliance | null; next: VehicleCompliance }
export function previewProfiles(text: string, trucks: TruckRow[]) {
  if (text.length > 200000) throw new Error("size");
  const [header, ...rows] = parseCsv(text);
  if (!header || header.join(",") !== PROFILE_HEADERS.join(",") || !rows.length || rows.length > 500) throw new Error("csv");
  const changes: ComplianceUpdate[] = [], errors: number[] = [], seen = new Set<string>();
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  rows.forEach((cells, i) => {
    const data = Object.fromEntries(PROFILE_HEADERS.map((h,j) => [h, (cells[j] ?? "").trim()]));
    const matches = trucks.filter(t => !t.archivedAt && norm(t.plate) === norm(data.plate));
    const next = parseCompliance(data), truck = matches[0];
    if (cells.length !== header.length || matches.length !== 1 || seen.has(truck.id) || !next) { errors.push(i + 2); return; }
    seen.add(truck.id); changes.push({ id: truck.id, plate: truck.plate, previous: truck.compliance ?? null, next });
  });
  return { changes, errors };
}
export function sameProfile(a?: VehicleCompliance | null, b?: VehicleCompliance | null) {
  if (!a || !b) return a == null && b == null;
  return PROFILE_HEADERS.slice(1).every(k => a[k as keyof VehicleCompliance] === b[k as keyof VehicleCompliance]);
}
