// Querra Fleet: stocarea fișierelor în spatele unei interfețe.
// Vercel Blob dacă există BLOB_READ_WRITE_TOKEN; altfel în Postgres (bytea, max ~2 MB după compresie) — adminul vede recomandarea Blob.
import type { FileKind, FileMeta, Store } from "./store/types";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
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
    const b = await put(`${firmId}/${o.kind}/${crypto.randomUUID()}-${o.name.replace(/[^\w.-]+/g, "_").slice(0, 60)}`, o.bytes, { access: "public", contentType: o.mime, addRandomSuffix: true });
    return s.addFile(firmId, { ...base, storage: "blob", url: b.url, data: null });
  }
  return s.addFile(firmId, { ...base, storage: "db", url: null, data: o.bytes });
}
export async function readFile(s: Store, firmId: string, id: string): Promise<{ meta: FileMeta; bytes: Buffer } | null> {
  const f = await s.file(firmId, id);
  if (!f) return null;
  if (f.storage === "db") return f.data ? { meta: f, bytes: Buffer.from(f.data) } : null;
  const r = await fetch(f.url!);
  return r.ok ? { meta: f, bytes: Buffer.from(await r.arrayBuffer()) } : null;
}
