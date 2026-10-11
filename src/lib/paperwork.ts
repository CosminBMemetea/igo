// Actele cursei: evenimente (încărcat/descărcat/așteptare) + poze CMR/POD. Pe demo: date fixe, coerente cu cursele demo.
import { store } from "./store";
import type { Tenant } from "./tenant";
import type { TripEventRow, TripEventKind } from "./store/types";

export interface PaperFile { id: string; kind: "cmr" | "pod"; src: string; name: string }
export interface Paperwork { events: Pick<TripEventRow, "kind" | "at" | "lat" | "lng">[]; files: PaperFile[]; podReceived: boolean; loadedAt: string | null; unloadedAt: string | null; waitMin: number; waiting: boolean; waitSince: string | null }

const ev = (kind: TripEventKind, at: string, lat: number | null = null, lng: number | null = null) => ({ kind, at, lat, lng });
const DEMO: Record<string, { events: Paperwork["events"]; files: PaperFile[]; pod: boolean }> = {
  "bh21qrt-15": { events: [ev("loaded", "2026-10-15T05:40:00Z", 47.06, 21.93), ev("wait_start", "2026-10-15T08:55:00Z", 46.77, 23.6), ev("wait_end", "2026-10-15T10:20:00Z", 46.77, 23.6)], files: [{ id: "demo-cmr-1", kind: "cmr", src: "/demo/cmr-1.svg", name: "CMR p.1" }, { id: "demo-cmr-2", kind: "cmr", src: "/demo/cmr-2.svg", name: "CMR p.2" }], pod: false },
  "cj08qrt-14": { events: [ev("loaded", "2026-10-14T06:10:00Z", 46.77, 23.6), ev("wait_start", "2026-10-14T13:05:00Z", 45.75, 21.23), ev("wait_end", "2026-10-14T15:45:00Z", 45.75, 21.23), ev("unloaded", "2026-10-14T16:30:00Z", 45.75, 21.23)], files: [{ id: "demo-cmr-3", kind: "cmr", src: "/demo/cmr-1.svg", name: "CMR p.1" }, { id: "demo-pod-1", kind: "pod", src: "/demo/pod-1.svg", name: "POD" }], pod: true },
};
export function summarize(events: Paperwork["events"], now = Date.now()) {
  let waitMs = 0, open: string | null = null;
  for (const e of events) {
    if (e.kind === "wait_start" && !open) open = e.at;
    if (e.kind === "wait_end" && open) { waitMs += Date.parse(e.at) - Date.parse(open); open = null; }
  }
  if (open) waitMs += Math.max(0, now - Date.parse(open));
  return { loadedAt: events.find((e) => e.kind === "loaded")?.at ?? null, unloadedAt: [...events].reverse().find((e) => e.kind === "unloaded")?.at ?? null, waitMin: Math.round(waitMs / 60000), waiting: !!open, waitSince: open };
}
export async function paperworkFor(tn: Tenant, tripId: string): Promise<Paperwork> {
  if (tn.demo || !tn.firm) {
    const d = DEMO[tripId] ?? { events: [], files: [], pod: false };
    return { events: d.events, files: d.files, podReceived: d.pod, ...summarize(d.events, Date.parse("2026-10-15T12:00:00Z")) };
  }
  const s = store();
  const [events, files, trips] = await Promise.all([s.tripEvents(tn.firm.id, tripId), s.files(tn.firm.id, { tripId }), s.trips(tn.firm.id)]);
  return { events, files: files.filter((f) => f.kind === "cmr" || f.kind === "pod").map((f) => ({ id: f.id, kind: f.kind as "cmr" | "pod", src: `/api/files/${f.id}`, name: f.name })), podReceived: !!trips.find((t) => t.id === tripId)?.podReceived, ...summarize(events) };
}
