import { writableFirm } from "@/lib/tenant";
import { store } from "@/lib/store";
import { clip, localNow } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export async function POST(req: Request) {
  const firm = await writableFirm(), fd = await req.formData(), id = clip(fd.get("id"), 60);
  if (!firm) return formReply(req, "/trips", "nofirm", 403);
  const trip = (await store().trips(firm.id)).find((t) => t.id === id);
  if (!trip || trip.date > localNow().slice(0, 10)) return formReply(req, "/trips", "missing", 409);
  if (!(await store().completeTrip(firm.id, id))) return formReply(req, `/trips/${id}`, "transition", 409);
  return formReply(req, `/trips/${id}`);
}
