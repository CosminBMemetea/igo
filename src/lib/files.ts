// Querra Fleet: stocarea fișierelor în spatele unei interfețe.
// Vercel Blob dacă există BLOB_READ_WRITE_TOKEN; altfel în Postgres (bytea, max ~2 MB după compresie) — adminul vede recomandarea Blob.
import type { FileKind, FileMeta, Store } from "./store/types";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { reportOperationFailure } from "./operation-error";
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
  await validateFileContent(o.bytes, o.mime);
  // The same document retried after a lost response has the same ID, even across devices.
  const id = o.tripId ? `fl_${createHash("sha256").update(JSON.stringify([firmId, o.tripId, o.kind])).update(o.bytes).digest("hex")}` : `fl_${crypto.randomUUID()}`;
  const base = { id, kind: o.kind, tripId: o.tripId ?? null, docId: o.docId ?? null, name: o.name.slice(0, 120), mime: o.mime, size: o.bytes.length, userId: o.userId };
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    // cale greu de ghicit; fișierul se servește tot prin /api/files/[id] (verificare de firmă)
    const b = await put(`${firmId}/${o.kind}/${crypto.randomUUID()}-${o.name.replace(/[^\w.-]+/g, "_").slice(0, 60)}`, o.bytes, { access: "private", contentType: o.mime, addRandomSuffix: true });
    const discard = async () => { try { const { del } = await import("@vercel/blob"); await del(b.url); } catch (e) { reportOperationFailure("blob-cleanup", e); } };
    try {
      const saved = await s.addFile(firmId, { ...base, storage: "blob", url: b.url, data: null });
      if (saved.url !== b.url) await discard(); // concurrent retry kept the original object
      return saved;
    } catch (e) {
      // A lost acknowledgement can follow a successful commit. Never delete that object's bytes.
      try {
        const committed = await s.file(firmId, id);
        if (committed?.url === b.url) { const { data: _data, ...meta } = committed; return meta; }
        await discard();
      } catch (readError) { reportOperationFailure("blob-commit-unknown-retained", readError); }
      throw e;
    }
  }
  return s.addFile(firmId, { ...base, storage: "db", url: null, data: o.bytes });
}
/** Decode the content rather than trusting a filename or caller-provided MIME. */
export async function validateFileContent(bytes: Buffer, mime: string): Promise<void> {
  try {
    if (mime === "application/pdf") {
      if (!bytes.subarray(0, 8).toString().startsWith("%PDF-") || !bytes.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new Error("pdf");
      const document = await PDFDocument.load(bytes, { throwOnInvalidObject: true });
      if (document.getPageCount() < 1) throw new Error("pdf");
    } else {
      const matches = mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === "image/webp" && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
      if (!matches) throw new Error("signature");
      const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" });
      const meta = await image.metadata();
      if (`image/${meta.format}` !== mime || !meta.width || !meta.height) throw new Error("mime");
      await image.resize(1, 1).raw().toBuffer();
    }
  } catch (e) {
    // Static imports above: dynamic import() of bare specifiers broke under tsx/Node 20 and was silently reported as "type".
    const msg = e instanceof Error ? e.message : String(e);
    if (!["pdf", "signature", "mime"].includes(msg)) console.warn("[file-validate]", mime, msg.slice(0, 200));
    throw new Error("type");
  }
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
