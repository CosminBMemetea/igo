// Ce mai are de făcut șoferul pe o cursă: pași simpli, culori clare. Fără date noi: doar evenimentele și pozele deja salvate.
import { groupDriverTrips, type DriverTripSummary } from "./driver-trips";

export type CheckKey = "start" | "cmr" | "delivery" | "pod";
/** done = gata · todo = de făcut acum (galben) · missing = lipsește (roșu) · later = mai târziu (gri) */
export type CheckState = "done" | "todo" | "missing" | "later";
export interface TripDocs { cmr: number; pod: number }
export interface CheckItem { key: CheckKey; state: CheckState }
export const CHECK_LABEL: Record<CheckKey, string> = {
  start: "Pornire|Start|Start",
  cmr: "CMR semnat|Signed CMR|Podpisany CMR",
  delivery: "Livrare|Delivery|Dostawa",
  pod: "POD / foto|POD / photo|POD / zdjęcie",
};
/** Textul butonului de acțiune pentru un act lipsă (o atingere → camera/încărcare pe pagina cursei). */
export const CHECK_ACTION: Partial<Record<CheckKey, string>> = {
  cmr: "Fotografiază CMR|Photo of CMR|Zdjęcie CMR",
  pod: "Trimite POD|Send POD|Wyślij POD",
};
export const DOC_KEYS: CheckKey[] = ["cmr", "pod"];
const NO_DOCS: TripDocs = { cmr: 0, pod: 0 };

export function tripChecklist(t: DriverTripSummary, docs: TripDocs = NO_DOCS, today: string): CheckItem[] {
  if (t.cancelledAt) return [];
  // POD-ul înseamnă livrat (și deci pornit): nu lăsăm „Livrare · de făcut” lângă „POD · gata”
  const podDone = !!t.podReceived || docs.pod > 0, delivered = !!t.deliveredAt || podDone, loaded = !!t.loadedAt || delivered;
  // cursă închisă de patron fără fluxul șoferului: șoferul nu mai poate încărca acte → nu o marcăm „lipsă”
  if (!t.planned && !t.deliveredAt) return [{ key: "start", state: "done" }, ...(docs.cmr ? [{ key: "cmr" as const, state: "done" as const }] : []), { key: "delivery", state: "done" }, ...(podDone ? [{ key: "pod" as const, state: "done" as const }] : [])];
  const due = t.date <= today;
  // POD-ul confirmă livrarea: după el nu mai cerem CMR-ul (patronul îl are deja în dosar)
  const cmr: CheckItem[] = docs.cmr > 0 ? [{ key: "cmr", state: "done" }] : podDone ? [] : [{ key: "cmr", state: loaded ? "missing" : due ? "todo" : "later" }];
  return [
    { key: "start", state: loaded ? "done" : t.date < today ? "missing" : due ? "todo" : "later" },
    ...cmr,
    { key: "delivery", state: delivered ? "done" : loaded ? "todo" : "later" },
    { key: "pod", state: podDone ? "done" : delivered ? "missing" : "later" },
  ];
}

export const minusDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

/** Cele trei liste ale ecranului „Curse”: Acum · Următoarele · Terminate (strict ultimele 30 de zile; cele mai vechi fără POD sunt în oldMissing → ecranul Acte). */
export function driverSections(trips: DriverTripSummary[], today: string) {
  const g = groupDriverTrips(trips, today), since = minusDays(today, 30);
  // „Terminate · 30 zile” înseamnă strict ultimele 30 de zile; cursele mai vechi fără POD apar doar la Acte (oldMissing), nu în listă.
  return { now: [...g.running, ...g.ready], next: g.upcoming, done: [...g.documents, ...g.finished].filter(x => x.date >= since), oldMissing: g.documents.filter(x => x.date < since), cancelled: g.cancelled.filter(x => x.date >= since) };
}

export interface MissingDoc { tripId: string; key: CheckKey; title: string; date: string; truckId: string | null }
/** Actele lipsă ale șoferului (CMR după încărcare, POD după livrare) pe cursele vizibile. */
export function missingDocs(trips: DriverTripSummary[], docs: Record<string, TripDocs>, today: string): MissingDoc[] {
  const s = driverSections(trips, today), out: MissingDoc[] = [];
  for (const t of [...s.now, ...s.done, ...s.oldMissing]) for (const c of tripChecklist(t, docs[t.id], today)) if (c.state === "missing" && DOC_KEYS.includes(c.key)) out.push({ tripId: t.id, key: c.key, title: t.title, date: t.date, truckId: t.truckId });
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.tripId.localeCompare(b.tripId));
}
