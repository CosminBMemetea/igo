import { store } from "@/lib/store";
import { writableFirm, tenant } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
import { deleteStoredFile } from "@/lib/files";
export const dynamic = "force-dynamic";
/** Patronul șterge definitiv o cursă a firmei lui: fișierele CMR/POD (inclusiv obiectele Blob), evenimentele (încărcat/descărcat/așteptare), apoi cursa. */
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData(), id = clip(fd.get("id"), 60);
  if (!f) return formReply(req, `/trips/${encodeURIComponent(id)}`, "nofirm", 403);
  const s = store(), trip = (await s.trips(f.id)).find((t) => t.id === id);
  if (!trip) return formReply(req, "/trips", "missing", 404);
  // o cursă în desfășurare (încărcată, nelivrată) se anulează/încheie întâi: șoferul ar rămâne cu ecranul gol pe drum
  if (trip.loadedAt && !trip.deliveredAt && !trip.cancelledAt) return formReply(req, `/trips/${encodeURIComponent(id)}`, "running", 409);
  const files = await s.files(f.id, { tripId: id });
  for (const file of files) await deleteStoredFile(s, f.id, file.id);
  if (!(await s.deleteTrip(f.id, id))) return formReply(req, "/trips", "missing", 404);
  console.info(JSON.stringify({ audit: "trip.delete", firm: f.id, by: (await tenant()).uid, id, title: trip.title, files: files.length }));
  return formReply(req, "/trips?deleted=1");
}
