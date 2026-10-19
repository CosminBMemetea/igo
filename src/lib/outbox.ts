"use client";
export interface OutboxItem { id: string; scope: string; actorId: string; kind: "event" | "fill"; label: string; created: number; payload: Record<string, string> | [string, FormDataEntryValue][]; status: "pending" | "blocked"; error?: number }
const changed = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("igo-outbox")); };
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("igo-driver-outbox", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("jobs", { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function operation<T>(mode: IDBTransactionMode, make: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("jobs", mode), req = make(tx.objectStore("jobs"));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error("storage")); };
  });
}
export async function outboxItems(scope: string): Promise<OutboxItem[]> {
  const all = await operation("readonly", (s) => s.getAll()) as OutboxItem[];
  return all.filter((x) => x.scope === scope).sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
}
export async function enqueue(item: Omit<OutboxItem, "created" | "status">) {
  const existing = await outboxItems(item.scope);
  if (existing.some((x) => x.id === item.id)) return;
  if (existing.length >= 20) throw new Error("full");
  await operation("readwrite", (s) => s.put({ ...item, created: Math.max(Date.now(), (existing.at(-1)?.created ?? 0) + 1), status: "pending" })); changed();
}
export async function removeOutbox(scope: string, id: string) {
  if (!(await outboxItems(scope)).some((x) => x.id === id)) return;
  await operation("readwrite", (s) => s.delete(id)); changed();
}
export function discardDependants(items: OutboxItem[], scope: string, id: string) {
  const ordered = items.filter(e => e.scope === scope).sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  const index = ordered.findIndex(e => e.id === id), item = ordered[index];
  if (!item || item.kind !== "event") return [];
  const tripId = (item.payload as Record<string, string>).tripId;
  return ordered.slice(index + 1).filter(e => e.kind === "event" && (e.payload as Record<string, string>).tripId === tripId).map(e => ({ ...e, status: "blocked" as const, error: 409 }));
}
/** Explicit discard is different from a server ACK: dependent steps require review. */
export async function discardOutbox(scope: string, id: string) {
  await operation("readwrite", s => {
    const req = s.getAll();
    req.onsuccess = () => {
      const items = req.result as OutboxItem[];
      if (!items.some(e => e.id === id && e.scope === scope)) return;
      for (const dependant of discardDependants(items, scope, id)) s.put(dependant);
      s.delete(id);
    };
    return req;
  });
  changed();
}
export async function retryOutbox(scope: string, id: string) {
  const item = (await outboxItems(scope)).find((x) => x.id === id); if (!item) return;
  await operation("readwrite", (s) => s.put({ ...item, status: "pending", error: undefined })); changed();
}
export function retryable(status: number) { return status === 408 || status === 429 || status >= 500; }
export async function transmit(item: OutboxItem, send: typeof fetch = fetch): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  let body: BodyInit;
  if (item.kind === "event") { headers["content-type"] = "application/json"; body = JSON.stringify({ ...item.payload, key: item.id, actorId: item.actorId }); }
  else { const fd = new FormData(); for (const [k,v] of item.payload as [string, FormDataEntryValue][]) fd.append(k,v); fd.set("key", item.id); fd.set("actorId", item.actorId); body = fd; }
  return send(item.kind === "event" ? "/api/trips/event" : "/api/driver/fill", { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(20000) });
}
export interface QueueStorage { list(scope: string): Promise<OutboxItem[]>; remove(scope: string, id: string): Promise<void>; block(item: OutboxItem): Promise<void> }
/** FIFO: never send a dependent event past a rejected or uncertain request. */
export async function drain(scope: string, storage: QueueStorage, send: (item: OutboxItem) => Promise<Response>) {
  let sent = 0;
  for (const item of await storage.list(scope)) {
    if (item.status === "blocked") break;
    let response: Response;
    try { response = await send(item); } catch { break; }
    if (response.ok) {
      const body = await response.json().catch(() => null);
      if (!body || !body.ok || body.demo) { await storage.block({ ...item, status: "blocked", error: 401 }); break; }
      if (item.kind === "event" && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("qf-trip-server-ack", { detail: { ...item.payload, scope, id: item.id, occurredAt: body.at ?? (item.payload as Record<string, string>).occurredAt } }));
      await storage.remove(scope, item.id); sent++;
    } else if (retryable(response.status)) break;
    else { await storage.block({ ...item, status: "blocked", error: response.status || 401 }); break; }
  }
  return sent;
}
const running = new Map<string, Promise<number>>();
export function flushOutbox(scope: string) {
  if (running.has(scope)) return running.get(scope)!;
  const promise = drain(scope, { list: outboxItems, remove: removeOutbox, block: async (item) => { await operation("readwrite", (s) => s.put(item)); changed(); } }, transmit).then((sent) => { if (sent) window.dispatchEvent(new Event("igo-outbox-synced")); return sent; }).finally(() => running.delete(scope));
  running.set(scope, promise); return promise;
}
