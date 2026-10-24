import { deleteStoredFile } from "@/lib/files";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
/** Patronul șterge un document al firmei lui. Un id care nu e al firmei (sau nu există) = „missing” (404 pe JSON), niciodată „ok”. */
export async function POST(req: Request) {
  let fd: FormData;
  try { fd = await req.formData(); } catch { return formReply(req, "/documents", "missing", 400); }
  const dest = `/documents?tab=${fd.get("tab") === "drivers" ? "drivers" : "vehicles"}`;
  const f = await writableFirm(); if (!f) return formReply(req, dest, "nofirm", 403);
  const id = clip(fd.get("id"), 60), s = store(), d = id ? (await s.docs(f.id)).find((x) => x.id === id) : undefined;
  if (!d) return formReply(req, dest, "missing", 404);
  if (d.fileId) await deleteStoredFile(s, f.id, d.fileId);
  await s.deleteDoc(f.id, d.id);
  return formReply(req, `${dest}&ok=1`);
}
