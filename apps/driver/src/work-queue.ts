import type { Board, Trip } from "./board";

export type EventKind = "loaded" | "unloaded" | "wait_start" | "wait_end";
export type WorkEntry = {
  id: string; scope: string; tripId: string; title: string; createdAt: string;
  status: "draft" | "queued" | "sending" | "attention" | "confirmed";
  attempts: number; nextAttempt: number; message?: string; confirmedAt?: number;
} & ({ type: "event"; kind: EventKind; truckId: string; shiftStart: string }
  | { type: "file"; kind: "cmr" | "pod"; fileName: string; size: number });
export type Snapshot = { board: Board; savedAt: number };
export type WorkState = { version: 1; entries: WorkEntry[]; boards: Record<string, Snapshot> };
type Dependencies = {
  load: () => Promise<WorkState | null>; save: (state: WorkState) => Promise<void>;
  scope: () => Promise<string>; send: (entry: WorkEntry) => Promise<void>; now?: () => number;
};
export const eventLabel: Record<EventKind, string> = { loaded: "Încărcare", unloaded: "Descărcare", wait_start: "Început așteptare", wait_end: "Sfârșit așteptare" };
export const entryLabel = (entry: WorkEntry) => entry.type === "event" ? eventLabel[entry.kind] : entry.kind.toUpperCase();
export const unconfirmed = (entry: WorkEntry) => entry.status !== "confirmed";
const empty = (): WorkState => ({ version: 1, entries: [], boards: {} });

/** Persist before sending. Serial storage mutations and one sender prevent a late ACK
 * from overwriting newly queued work. The sender never crosses account/backend scopes. */
export function createWorkQueue(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  let tail: Promise<unknown> = Promise.resolve();
  const flights = new Map<string, Promise<void>>();
  const active = new Set<string>();
  async function mutate<T>(fn: (state: WorkState) => T): Promise<T> {
    const job = tail.then(async () => {
      const state = await deps.load() ?? empty();
      const result = fn(state); await deps.save(state); return result;
    });
    tail = job.catch(() => {}); return job;
  }
  async function state() { await tail; return await deps.load() ?? empty(); }
  async function list(scope: string) { return (await state()).entries.filter(e => e.scope === scope); }
  async function update(scope: string, id: string, patch: Partial<WorkEntry>) {
    await mutate(s => { const row = s.entries.find(e => e.scope === scope && e.id === id); if (row) Object.assign(row, patch); });
  }
  return {
    list,
    snapshot: async (scope: string) => (await state()).boards[scope] ?? null,
    async cache(scope: string, board: Board) {
      await mutate(s => {
        s.boards[scope] = { board, savedAt: now() };
        s.entries = s.entries.filter(e => e.status !== "confirmed" || !e.confirmedAt || now() - e.confirmedAt < 7 * 86400000);
      });
    },
    async add(entry: WorkEntry) {
      if (await deps.scope() !== entry.scope) throw new Error("Contul s-a schimbat. Reia operația în contul corect.");
      await mutate(s => {
        if (s.entries.some(e => e.id === entry.id)) return;
        if (s.entries.filter(e => e.scope === entry.scope && unconfirmed(e)).length >= 100) throw new Error("Ai 100 de operațiuni locale. Sincronizează sau verifică lista din Acte înainte de a adăuga altele.");
        s.entries.push(entry);
      });
    },
    async submit(scope: string, id: string) {
      if (await deps.scope() !== scope) throw new Error("Contul s-a schimbat.");
      const entry = (await list(scope)).find(e => e.id === id);
      if (!entry || entry.status === "confirmed" || active.has(id)) return;
      await update(scope, id, { status: "queued", nextAttempt: 0, message: undefined });
    },
    async discard(scope: string, id: string) {
      if (active.has(id)) throw new Error("Operația se trimite. Așteaptă rezultatul înainte de a o elimina.");
      return mutate(s => {
        const row = s.entries.find(e => e.scope === scope && e.id === id);
        if (!row) return null;
        s.entries = s.entries.filter(e => e !== row);
        if (row.type === "event" && unconfirmed(row)) {
          for (const later of s.entries) if (later.scope === scope && later.tripId === row.tripId && unconfirmed(later) && later.createdAt >= row.createdAt) {
            later.status = "attention"; later.message = "O etapă anterioară a fost eliminată. Verifică situația cursei cu firma.";
          }
        }
        return row;
      });
    },
    async sync(scope: string, force = false) {
      if (flights.has(scope)) return flights.get(scope);
      const job = (async () => {
        const blocked = new Set<string>();
        // Fixed batch: new operations join the next pass, never an unbounded background loop.
        for (const original of await list(scope)) {
          if (await deps.scope() !== scope) return;
          const entry = (await list(scope)).find(e => e.id === original.id);
          if (!entry || entry.status === "draft" || entry.status === "confirmed") continue;
          if (entry.status === "attention" || blocked.has(entry.tripId)) { blocked.add(entry.tripId); continue; }
          if (!force && entry.nextAttempt > now()) { blocked.add(entry.tripId); continue; }
          active.add(entry.id);
          try {
            await update(scope, entry.id, { status: "sending", message: undefined });
            await deps.send(entry);
            await update(scope, entry.id, { status: "confirmed", confirmedAt: now(), message: undefined });
          } catch (error) {
            const e = error as { status?: number; code?: string };
            const auth = e.status === 401 || e.code === "account-changed";
            const permanent = !auth && !!e.status && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status);
            await update(scope, entry.id, {
              status: permanent ? "attention" : "queued", attempts: entry.attempts + 1,
              nextAttempt: now() + Math.min(300000, 15000 * 2 ** Math.min(entry.attempts, 5)),
              message: auth ? "Autentifică-te din nou. Operația rămâne pe telefon."
                : permanent ? e.code === "local-file-missing" ? "Fotografia locală nu mai este disponibilă. Adaugă din nou documentul."
                  : "Firma nu a acceptat operația. Cursa, alocarea sau documentul necesită verificare."
                : "Salvat pe telefon. Reîncercăm când aplicația este deschisă și ai internet.",
            });
            blocked.add(entry.tripId);
            // Connection/auth failures affect the whole batch; do not hammer the server.
            if (!permanent) throw error;
          } finally { active.delete(entry.id); }
        }
      })();
      flights.set(scope, job);
      try { await job; } finally { flights.delete(scope); }
    },
  };
}

/** Local progress is explicitly marked and never affects server rewards or POD status. */
export function projectedBoard(snapshot: Snapshot, entries: WorkEntry[]): Board {
  const board: Board = JSON.parse(JSON.stringify(snapshot.board));
  const trips = Object.values(board.trips).flat();
  const blocked = new Set<string>();
  for (const e of entries) {
    if (e.status === "draft") continue;
    if (e.status === "attention") { blocked.add(e.tripId); continue; }
    if (e.type !== "event" || blocked.has(e.tripId) || e.status === "confirmed" && (e.confirmedAt ?? 0) <= snapshot.savedAt) continue;
    const trip = trips.find(t => t.id === e.tripId);
    if (!trip || trip.cancelledAt || trip.truckId !== e.truckId) continue;
    trip.localPending = true;
    if (e.kind === "loaded") trip.loadedAt ??= e.createdAt;
    if (e.kind === "unloaded") trip.deliveredAt ??= e.createdAt;
    if (e.kind === "wait_start") trip.waitSince = e.createdAt;
    if (e.kind === "wait_end") trip.waitSince = null;
  }
  const groups: Record<string, Trip[]> = { running: [], ready: [], upcoming: [], documents: [], finished: [], cancelled: [] };
  // Server's Romanian date remains the basis when offline, not the phone timezone.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(board.serverTime));
  for (const t of trips) {
    const key = t.cancelledAt ? "cancelled" : t.deliveredAt ? t.podReceived ? "finished" : "documents" : !t.planned ? "finished" : t.loadedAt ? "running" : t.date > today ? "upcoming" : "ready";
    groups[key].push(t);
  }
  board.trips = groups; return board;
}
