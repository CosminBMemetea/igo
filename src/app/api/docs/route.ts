import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip, isDate } from "@/lib/validate";
import { DRIVER_DOC_TYPES, VEHICLE_DOC_TYPES, type DocType } from "@/lib/store/types";
import { saveFile } from "@/lib/files";
export const dynamic = "force-dynamic";
/** Adaugă sau modifică un document (vehicul sau șofer), cu fișier opțional (poză/PDF, max 2 MB). */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/documents?e=nofirm");
  const fd = await req.formData();
  const id = clip(fd.get("id"), 60), scope = fd.get("scope") === "driver" ? "driver" : "vehicle";
  const type = clip(fd.get("type"), 20) as DocType, expires = clip(fd.get("expires"), 10), target = clip(fd.get("target"), 60);
  const dueKmRaw = clip(fd.get("dueKm"), 9), note = clip(fd.get("note"), 200) || null;
  const tab = scope === "driver" ? "drivers" : "vehicles", err = (e: string) => back(req, `/documents?tab=${tab}&e=${e}${id ? `&edit=${id}` : "&add=1"}`);
  if (!(scope === "driver" ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES).includes(type as never)) return err("type");
  if (!isDate(expires)) return err("date");
  const dueKm = dueKmRaw ? Number(dueKmRaw) : null;
  if (dueKm != null && !(Number.isInteger(dueKm) && dueKm > 0 && dueKm < 10_000_000)) return err("km");
  const s = store();
  const d = { truckId: scope === "vehicle" ? target : null, userId: scope === "driver" ? target : null, scope, type, expires, dueKm, note } as const;
  let docId = id;
  try {
    if (id) { if (!(await s.updateDoc(f.id, id, d))) return err("missing"); }
    else docId = (await s.addDoc(f.id, d)).id;
  } catch { return err("target"); }
  const file = fd.get("file");
  if (file instanceof File && file.size) {
    try {
      const m = await saveFile(s, f.id, { kind: "doc", docId, name: file.name, mime: file.type, bytes: Buffer.from(await file.arrayBuffer()), userId: null });
      await s.updateDoc(f.id, docId, { fileId: m.id });
    } catch (e) { return back(req, `/documents?tab=${tab}&e=file-${(e as Error).message === "size" ? "size" : "type"}&edit=${docId}`); }
  }
  return back(req, `/documents?tab=${tab}&ok=1`);
}
