import type { PaperFile } from "./paperwork";
import type { OutboxItem } from "./outbox";

export type PaperworkState = { loadedAt: string | null; unloadedAt: string | null; waitMin: number; waitSince: string | null; files: PaperFile[]; lastEventAt?: string | null };
export type PaperworkAck = { id: string; tripId: string; kind: string; at: string };

/** Keep accepted events until the server snapshot catches up. Rejected events
 * and their dependants never become completed steps in the UI. */
export function projectPaperwork(initial: PaperworkState, tripId: string, items: OutboxItem[], accepted: PaperworkAck[] = []) {
  const state = { ...initial };
  const queued = items.filter(e => e.kind === "event" && (e.payload as Record<string, string>).tripId === tripId);
  const events = new Map(accepted.filter(e => e.tripId === tripId).map(e => [e.id, { ...e, blocked: false }]));
  for (const e of queued) {
    const p = e.payload as Record<string, string>;
    // An ACK wins over a still-visible copy of that same operation in IndexedDB.
    if (!events.has(e.id)) events.set(e.id, { id: e.id, tripId, kind: p.kind, at: p.occurredAt, blocked: e.status === "blocked" });
  }
  const watermark = Date.parse(initial.lastEventAt ?? "") || 0;
  for (const e of [...events.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (e.blocked) break;
    if (!Number.isFinite(Date.parse(e.at)) || Date.parse(e.at) <= watermark || state.unloadedAt) continue;
    if (e.kind === "loaded" && !state.loadedAt && !state.waitSince) state.loadedAt = e.at;
    if (e.kind === "unloaded" && state.loadedAt && !state.waitSince && Date.parse(e.at) >= Date.parse(state.loadedAt)) state.unloadedAt = e.at;
    if (e.kind === "wait_start" && !state.waitSince) state.waitSince = e.at;
    if (e.kind === "wait_end" && state.waitSince && Date.parse(e.at) >= Date.parse(state.waitSince)) {
      state.waitMin += Math.round((Date.parse(e.at) - Date.parse(state.waitSince)) / 60000); state.waitSince = null;
    }
  }
  return { state, pending: queued.length > 0, blocked: queued.some(e => e.status === "blocked") };
}

export function mergePaperFiles(...groups: PaperFile[][]) {
  return [...new Map(groups.flat().map(file => [file.id, file])).values()];
}
