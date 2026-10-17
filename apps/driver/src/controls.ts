import { api, ApiError, read, write, sessionScope, type Pending } from "./api";
type Entry = Pending & { id: string };
type Queue = Record<string, Entry>;
const KEY = "pending-controls-v2";
let storageTail: Promise<unknown> = Promise.resolve();
const flights = new Map<string, Promise<void>>();
function change(fn: (queue: Queue) => void) {
  const job = storageTail.then(async () => { const queue = await read<Queue>(KEY) ?? {}; fn(queue); await write(KEY, queue); });
  storageTail = job.catch(() => {}); return job;
}
export async function pendingControl() {
  const scope = await sessionScope();
  await storageTail;
  return (await read<Queue>(KEY))?.[scope] ?? null;
}
export async function queueControl(pending: Pending) {
  const scope = await sessionScope();
  const entry: Entry = { ...pending, id: `${Date.now()}-${Math.random()}` };
  await change(queue => {
    const previous = queue[scope];
    // A stale screen may still offer Privat after an offline shift stop.
    // Keep the stronger intent for that same shift until it is acknowledged.
    if (previous?.path === "/api/driver/shift" && entry.path === "/api/driver/private"
      && previous.body.vehicleId === entry.body.vehicleId && previous.body.expectedShiftStart === entry.body.expectedShiftStart) return;
    queue[scope] = entry;
  });
}
/** One sender per account. A delayed ACK may only retire the exact command sent. */
export async function syncPending() {
  const scope = await sessionScope();
  const existing = flights.get(scope); if (existing) return existing;
  const job = (async () => {
    for (;;) {
      await storageTail;
      const pending = (await read<Queue>(KEY))?.[scope];
      if (!pending) return;
      try { await api(pending.path, pending.body, { scope }); }
      catch (e) {
        // The old shift/assignment no longer exists; never apply its command to a new one.
        if (!(e instanceof ApiError && ["stale-shift", "no-shift", "assignment"].includes(e.code))) throw e;
      }
      await change(queue => { if (queue[scope]?.id === pending.id) delete queue[scope]; });
      if (await sessionScope() !== scope) return;
    }
  })();
  flights.set(scope, job);
  try { await job; } finally { flights.delete(scope); }
}
