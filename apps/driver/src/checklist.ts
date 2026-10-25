// Port of the web src/lib/driver-checklist.ts + driver-trips stage rules, over the mobile board Trip type.
import type { Board, Trip } from "./board";
import type { WorkEntry } from "./work-queue";
export type Stage = "running" | "ready" | "upcoming" | "documents" | "finished" | "cancelled";
export type CheckKey = "start" | "cmr" | "delivery" | "pod";
export type CheckState = "done" | "todo" | "missing" | "later";
export type TripDocs = { cmr: number; pod: number };
export type CheckItem = { key: CheckKey; state: CheckState };
export const CHECK_LABEL: Record<CheckKey, string> = {
  start: "Pornire|Start|Start", cmr: "CMR semnat|Signed CMR|Podpisany CMR", delivery: "Livrare|Delivery|Dostawa", pod: "POD / foto|POD / photo|POD / zdjęcie",
};
export const CHECK_ACTION: Partial<Record<CheckKey, string>> = { cmr: "Fotografiază CMR|Photo of CMR|Zdjęcie CMR", pod: "Trimite POD|Send POD|Wyślij POD" };
export const DOC_KEYS: CheckKey[] = ["cmr", "pod"];
export const STAGE_LABEL: Record<Stage, string> = {
  running: "Încărcată · în desfășurare|Loaded · in progress|Załadowany · w trakcie", ready: "De încărcat|Ready for loading|Do załadunku",
  upcoming: "Planificată|Scheduled|Zaplanowany", documents: "Livrată · lipsește POD|Delivered · POD needed|Dostarczony · brakuje POD",
  finished: "Încheiată|Completed|Zakończony", cancelled: "Anulată|Cancelled|Anulowany",
};
export function stageOf(t: Trip, today: string): Stage {
  if (t.cancelledAt) return "cancelled";
  if (t.deliveredAt) return t.podReceived ? "finished" : "documents";
  if (!t.planned) return "finished";
  if (t.loadedAt) return "running";
  return t.date > today ? "upcoming" : "ready";
}
/** Server Romanian calendar day, not the phone's timezone. */
export function boardToday(board: Board) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(board.serverTime));
}
/** Server files plus photos already handed to the phone's send queue (not drafts, not rejected). */
export function tripDocs(board: Board, entries: WorkEntry[]) {
  const out: Record<string, TripDocs> = {};
  for (const f of board.paperwork ?? []) (out[f.tripId] ??= { cmr: 0, pod: 0 })[f.kind]++;
  for (const e of entries) if (e.type === "file" && e.status !== "draft" && e.status !== "attention" && e.status !== "confirmed") (out[e.tripId] ??= { cmr: 0, pod: 0 })[e.kind]++;
  return out;
}
const NO_DOCS: TripDocs = { cmr: 0, pod: 0 };
export function tripChecklist(t: Trip, docs: TripDocs = NO_DOCS, today: string): CheckItem[] {
  if (t.cancelledAt) return [];
  const podDone = !!t.podReceived || docs.pod > 0, delivered = !!t.deliveredAt || podDone, loaded = !!t.loadedAt || delivered;
  if (!t.planned && !t.deliveredAt) return [{ key: "start", state: "done" }, ...(docs.cmr ? [{ key: "cmr" as const, state: "done" as const }] : []), { key: "delivery", state: "done" }, ...(podDone ? [{ key: "pod" as const, state: "done" as const }] : [])];
  const due = t.date <= today;
  const cmr: CheckItem[] = docs.cmr > 0 ? [{ key: "cmr", state: "done" }] : podDone ? [] : [{ key: "cmr", state: loaded ? "missing" : due ? "todo" : "later" }];
  return [
    { key: "start", state: loaded ? "done" : t.date < today ? "missing" : due ? "todo" : "later" },
    ...cmr,
    { key: "delivery", state: delivered ? "done" : loaded ? "todo" : "later" },
    { key: "pod", state: podDone ? "done" : delivered ? "missing" : "later" },
  ];
}
export const minusDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
export function driverSections(board: Board, today: string) {
  const g = board.trips, since = minusDays(today, 30), get = (k: Stage) => g[k] ?? [];
  return { now: [...get("running"), ...get("ready")], next: get("upcoming"), done: [...get("documents"), ...get("finished")].filter(x => x.date >= since),
    oldMissing: get("documents").filter(x => x.date < since), cancelled: get("cancelled").filter(x => x.date >= since) };
}
export type MissingDoc = { trip: Trip; key: CheckKey };
export function missingDocs(board: Board, docs: Record<string, TripDocs>, today: string): MissingDoc[] {
  const s = driverSections(board, today), out: MissingDoc[] = [];
  for (const t of [...s.now, ...s.done, ...s.oldMissing]) for (const c of tripChecklist(t, docs[t.id], today)) if (c.state === "missing" && DOC_KEYS.includes(c.key)) out.push({ trip: t, key: c.key });
  return out.sort((a, b) => b.trip.date.localeCompare(a.trip.date) || a.trip.id.localeCompare(b.trip.id));
}
/** "Cluj-Napoca → Budapesta" → stops, same separators as the web TripRoute. */
export const routeStops = (title: string) => title.split(/\s+(?:→|·|–|—)\s+/);
