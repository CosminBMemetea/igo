import { Directory, File, Paths } from "expo-file-system";
import { api, ApiError, sessionScope } from "./api";
import { createWorkQueue, type WorkState, type WorkEntry } from "./work-queue";

const folder = () => new Directory(Paths.document, "driver-work-v1");
const listeners = new Set<() => void>();
export function watchWork(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const workFile = (name: string) => {
  if (!/^work-[\w-]+\.jpg$/.test(name)) throw new Error("Fișier local invalid.");
  return new File(folder(), name);
};
export const workId = () => `work-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
async function journal() {
  const dir = folder();
  if (!dir.exists) return null;
  const versions = dir.list().filter((file): file is File => file instanceof File && /^journal-\d+\.json$/.test(file.name)).sort((a, b) => Number(b.name.slice(8, -5)) - Number(a.name.slice(8, -5)));
  for (const file of versions) {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.version === 1 && Array.isArray(parsed.entries) && parsed.boards) return { state: parsed as WorkState, revision: Number(file.name.slice(8, -5)) };
    } catch { /* Interrupted last write: retain the previous complete generation. */ }
  }
  if (versions.length) throw new Error("Operațiunile locale nu pot fi citite. Nu șterge aplicația; contactează suportul.");
  return null;
}
async function save(state: WorkState) {
  const dir = folder(); await dir.create({ intermediates: true, idempotent: true });
  const revision = Math.max(Date.now(), (await journal())?.revision ?? 0) + 1;
  // Never overwrite the only valid copy. Retries reuse the same operation IDs.
  await new File(dir, `journal-${revision}.json`).write(JSON.stringify(state));
  const versions = dir.list().filter((file): file is File => file instanceof File && /^journal-\d+\.json$/.test(file.name)).sort((a, b) => Number(b.name.slice(8, -5)) - Number(a.name.slice(8, -5)));
  for (const file of versions.slice(2)) { try { file.delete(); } catch { /* Retry cleanup on next write. */ } }
  for (const listener of listeners) listener();
}
async function send(entry: WorkEntry) {
  if (entry.type === "event") {
    await api("/api/trips/event", { tripId: entry.tripId, kind: entry.kind, key: entry.id, occurredAt: entry.createdAt, expectedTruckId: entry.truckId, expectedShiftStart: entry.shiftStart }, { scope: entry.scope });
  } else {
    const file = workFile(entry.fileName);
    if (!file.exists) throw new ApiError(422, "local-file-missing");
    const body = new FormData();
    body.append("tripId", entry.tripId); body.append("kind", entry.kind);
    // React Native streams the app-private file without a base64 copy in JS.
    body.append("file", { uri: file.uri, name: `${entry.kind}.jpg`, type: "image/jpeg" } as unknown as Blob);
    const result = await api<{ id?: string }>("/api/files", body, { scope: entry.scope, multipart: true });
    if (!result.id) throw new Error("Documentul nu a fost confirmat de firmă.");
  }
}
export const workQueue = createWorkQueue({ load: async () => (await journal())?.state ?? null, save, scope: sessionScope, send });
export async function discardWork(scope: string, id: string) {
  const entry = await workQueue.discard(scope, id);
  if (entry?.type === "file") { const file = workFile(entry.fileName); if (file.exists) await file.delete(); }
}
export async function cleanConfirmedPhotos(scope: string) {
  for (const entry of await workQueue.list(scope)) if (entry.type === "file" && entry.status === "confirmed") {
    const file = workFile(entry.fileName); try { if (file.exists) file.delete(); } catch { /* Retry cleanup on next refresh. */ }
  }
}
export async function persistPhoto(source: string, name: string) {
  await folder().create({ intermediates: true, idempotent: true });
  await new File(source).copy(workFile(name), { overwrite: true });
}
