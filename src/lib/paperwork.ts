// Actele cursei: evenimente (încărcat/descărcat/așteptare) + poze CMR/POD. Pe demo: date fixe, coerente cu cursele demo.
import { TRIPS } from "./fleet/seed";
import { TRUCKS, DEMO_DAY, DEMO_NOW_MIN, minToHHMM } from "./fleet/data";
import { roIso } from "./demo-time";
import { store } from "./store";
import { demoDelta, shiftDeep, shiftStr } from "./demo-time";
import type { Tenant } from "./tenant";
import type { TripEventRow, TripEventKind } from "./store/types";

export interface PaperFile { id: string; kind: "cmr" | "pod"; src: string; name: string }
export interface Paperwork { events: Pick<TripEventRow, "kind" | "at" | "lat" | "lng">[]; files: PaperFile[]; podReceived: boolean; loadedAt: string | null; unloadedAt: string | null; waitMin: number; waiting: boolean; waitSince: string | null }

const ev = (kind: TripEventKind, at: string, lat: number | null = null, lng: number | null = null) => ({ kind, at, lat, lng });
function demoPaperwork(tripId: string) {
  const tr = TRIPS.find((t) => t.id === tripId), truck = TRUCKS.find((t) => t.id === tr?.vehicleId);
  if (!tr || !truck) return { events: [], files: [], pod: false };
  const back = tr.title === truck.routeName.split(" → ").reverse().join(" → ");
  const route = back ? [...truck.route].reverse() : truck.route, first = route[0].at, last = route[route.length - 1].at;
  const events = [ev("loaded", tr.loadedAt ?? roIso(tr.date, "07:00"), ...first)];
  const unloaded = tr.deliveredAt ?? (!tr.active ? roIso(tr.date, minToHHMM(7 * 60 + tr.hours * 60 + 70)) : null);
  if (unloaded) events.push(ev("unloaded", unloaded, ...last));
  // Fișierele sunt exemple, fără date ale unor clienți reali.
  const files: PaperFile[] = [{ id: `demo-cmr-${tr.id}`, kind: "cmr", src: "/demo/cmr-1.svg", name: "CMR · demo" }];
  if (unloaded) files.push({ id: `demo-pod-${tr.id}`, kind: "pod", src: "/demo/pod-1.svg", name: "POD · demo" });
  return { events, files, pod: !!unloaded };
}
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
    const k = demoDelta(), d = demoPaperwork(tripId);
    const events = shiftDeep(d.events, k);
    return { events, files: d.files, podReceived: d.pod, ...summarize(events, Date.parse(shiftStr(roIso(DEMO_DAY, minToHHMM(DEMO_NOW_MIN)), k))) };
  }
  const s = store();
  const [events, files, trips] = await Promise.all([s.tripEvents(tn.firm.id, tripId), s.files(tn.firm.id, { tripId }), s.trips(tn.firm.id)]);
  return { events, files: files.filter((f) => f.kind === "cmr" || f.kind === "pod").map((f) => ({ id: f.id, kind: f.kind as "cmr" | "pod", src: `/api/files/${f.id}`, name: f.name })), podReceived: !!trips.find((t) => t.id === tripId)?.podReceived, ...summarize(events) };
}
