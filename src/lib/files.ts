// Querra Fleet: stocarea fișierelor în spatele unei interfețe.
// Vercel Blob dacă există BLOB_READ_WRITE_TOKEN; altfel în Postgres (bytea, max ~2 MB după compresie) — adminul vede recomandarea Blob.
import type { FileKind, FileMeta, Store } from "./store/types";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_ACCESS === "private";
export type FileErr = "size" | "type" | "empty";
export function checkFile(size: number, mime: string): FileErr | null {
  if (!size) return "empty";
  if (size > MAX_FILE_BYTES) return "size";
  if (!ALLOWED_MIME.includes(mime)) return "type";
  return null;
}
export async function saveFile(s: Store, firmId: string, o: { kind: FileKind; tripId?: string | null; docId?: string | null; name: string; mime: string; bytes: Buffer; userId: string | null }): Promise<FileMeta> {
  const err = checkFile(o.bytes.length, o.mime);
  if (err) throw new Error(err);
  const base = { kind: o.kind, tripId: o.tripId ?? null, docId: o.docId ?? null, name: o.name.slice(0, 120), mime: o.mime, size: o.bytes.length, userId: o.userId };
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    // cale greu de ghicit; fișierul se servește tot prin /api/files/[id] (verificare de firmă)
    const b = await put(`${firmId}/${o.kind}/${crypto.randomUUID()}-${o.name.replace(/[^\w.-]+/g, "_").slice(0, 60)}`, o.bytes, { access: "private", contentType: o.mime, addRandomSuffix: true });
    try { return await s.addFile(firmId, { ...base, storage: "blob", url: b.url, data: null }); }
    catch (e) { const { del } = await import("@vercel/blob"); await del(b.url); throw e; }
  }
  return s.addFile(firmId, { ...base, storage: "db", url: null, data: o.bytes });
}
export async function readFile(s: Store, firmId: string, id: string): Promise<{ meta: FileMeta; bytes: Buffer } | null> {
  const f = await s.file(firmId, id);
  if (!f) return null;
  if (f.storage === "db") return f.data ? { meta: f, bytes: Buffer.from(f.data) } : null;
  if (new URL(f.url!).hostname.includes(".private.blob.")) {
    const { get } = await import("@vercel/blob");
    const r = await get(f.url!, { access: "private", useCache: false });
    return r?.statusCode === 200 ? { meta: f, bytes: Buffer.from(await new Response(r.stream).arrayBuffer()) } : null;
  }
  // Backward-compatible read of legacy public objects; migration is a separate operation.
  const r = await fetch(f.url!);
  return r.ok ? { meta: f, bytes: Buffer.from(await r.arrayBuffer()) } : null;
}

export async function deleteStoredFile(s: Store, firmId: string, id: string) {
  const file = await s.file(firmId, id); if (!file) return false;
  if (file.storage === "blob" && file.url) { const { del } = await import("@vercel/blob"); await del(file.url); }
  return s.deleteFile(firmId, id);
}
