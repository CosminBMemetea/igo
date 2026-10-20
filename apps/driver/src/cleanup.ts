import { api, apiOrigin, ApiError, read, write } from "./api";
type Entry = { receipt: string; expiresAt: string; origin: string; attempts: number; nextAttempt: number };
const KEY = "pending-revocations-v1";
let tail: Promise<unknown> = Promise.resolve(), flight: Promise<void> | null = null;
function change(fn: (queue: Entry[]) => Entry[]) {
  const job = tail.then(async () => { await write(KEY, fn(await read<Entry[]>(KEY) ?? [])); });
  tail = job.catch(() => {}); return job;
}
/** Persist only revocation rights, never a login bearer or password. */
export async function queueRevocation(receipt: string, expiresAt: string) {
  if (!receipt || !Number.isFinite(Date.parse(expiresAt))) throw new Error("Revocarea nu poate fi salvată.");
  const origin = apiOrigin();
  await change(queue => queue.some(e => e.receipt === receipt) ? queue : [...queue, { receipt, expiresAt, origin, attempts: 0, nextAttempt: 0 }]);
}
export async function pendingRevocations() {
  await tail;
  return (await read<Entry[]>(KEY) ?? []).filter(e => Date.parse(e.expiresAt) > Date.now()).length;
}
export async function syncRevocations() {
  if (flight) return flight;
  const job = (async () => {
    await tail;
    for (const entry of await read<Entry[]>(KEY) ?? []) {
      if (Date.parse(entry.expiresAt) <= Date.now()) {
        await change(q => q.filter(e => e.receipt !== entry.receipt)); continue;
      }
      if (entry.origin !== apiOrigin() || entry.nextAttempt > Date.now()) continue;
      try { await api("/api/auth/mobile/logout", { receipt: entry.receipt }, { anonymous: true }); }
      catch (error) {
        if (!(error instanceof ApiError && error.status === 400)) {
          await change(q => q.map(e => e.receipt === entry.receipt ? { ...e, attempts: e.attempts + 1, nextAttempt: Date.now() + Math.min(300000, 15000 * 2 ** Math.min(e.attempts, 5)) } : e));
          continue;
        }
      }
      await change(q => q.filter(e => e.receipt !== entry.receipt));
    }
  })();
  flight = job;
  try { await job; } finally { if (flight === job) flight = null; }
}
