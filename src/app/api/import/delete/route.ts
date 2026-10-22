import { store } from "@/lib/store";
import { writableFirm, tenant } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
/** Patronul șterge rânduri de carburant importate din CSV (un rând sau tot lotul unui import). Alertele de carburant derivă din rânduri: se recalculează la următoarea afișare, ca la ștergerea bonului. Bonurile șoferilor nu se ating aici. */
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData(), ret = fd.get("ret") === "/receipts" ? "/receipts" : "/import";
  if (!f) return formReply(req, ret, "nofirm", 403);
  const id = clip(fd.get("id"), 60), importId = clip(fd.get("importId"), 60);
  if (!id && !importId) return formReply(req, ret, "missing", 404);
  const n = await store().deleteImportedFuel(f.id, id ? { id } : { importId });
  if (!n && !importId) return formReply(req, ret, "missing", 404);
  console.info(JSON.stringify({ audit: id ? "fuel.delete" : "fuel.import.delete", firm: f.id, by: (await tenant()).uid, id: id || importId, rows: n }));
  return formReply(req, `${ret}?deleted=${n}`);
}
