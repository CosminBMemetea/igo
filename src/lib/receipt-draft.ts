"use client";
export interface ReceiptDraft {
  vehicleId: string; key: string; form: boolean;
  fields: { litres: string; odo: string; amount: string; station: string };
  photo: File | null; currency: string; date: string; plate: string; aiOk: boolean;
}
// Memory preserves a draft across component unmounts even if device storage fails.
const memory = new Map<string, ReceiptDraft>();
let writes: Promise<unknown> = Promise.resolve();
async function operation<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("igo-receipt-drafts", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("drafts"); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", mode), req = run(tx.objectStore("drafts"));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error("storage")); };
  });
}
export async function loadReceiptDraft(scope: string): Promise<ReceiptDraft | undefined> {
  if (memory.has(scope)) return memory.get(scope);
  await writes.catch(() => {});
  const saved = await operation("readonly", s => s.get(scope)) as ReceiptDraft | undefined;
  // A newer edit wins over an asynchronous disk read.
  if (memory.has(scope)) return memory.get(scope);
  if (saved) memory.set(scope, saved);
  return saved;
}
export function saveReceiptDraft(scope: string, draft: ReceiptDraft): Promise<unknown> {
  memory.set(scope, draft);
  const write = writes.catch(() => {}).then(() => operation("readwrite", s => s.put(draft, scope)));
  writes = write;
  return write;
}
/** Called on the login screen (reached after logout): a fresh login must never see the previous session's receipt draft. */
export function clearReceiptDrafts(): void {
  memory.clear();
  try { indexedDB.deleteDatabase("igo-receipt-drafts"); } catch { /* storage unavailable */ }
}
