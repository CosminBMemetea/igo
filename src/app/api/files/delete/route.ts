import { store } from "@/lib/store";
import { writableFirm, tenant } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
import { deleteStoredFile } from "@/lib/files";
export const dynamic = "force-dynamic";
/** Owner removes an uploaded CMR/POD file from a trip of their firm. */
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData(), id = clip(fd.get("id"), 120), trip = clip(fd.get("tripId"), 60);
  const dest = `/trips/${encodeURIComponent(trip)}`;
  if (!f) return formReply(req, dest, "nofirm", 403);
  const s = store(), meta = await s.file(f.id, id);
  if (!meta || !meta.tripId || meta.tripId !== trip) return formReply(req, dest, "missing", 404);
  if (!(await deleteStoredFile(s, f.id, id))) return formReply(req, dest, "missing", 404);
  console.info(JSON.stringify({ audit: "file.delete", firm: f.id, by: (await tenant()).uid, id, trip, name: meta.name }));
  return formReply(req, `${dest}?ok=1`);
}
