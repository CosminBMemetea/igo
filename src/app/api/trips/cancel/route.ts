import { writableFirm } from "@/lib/tenant";
import { store } from "@/lib/store";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export async function POST(req: Request) {
  const firm = await writableFirm(), fd = await req.formData(), id = clip(fd.get("id"), 80), reason = clip(fd.get("reason"), 500);
  if (!firm) return formReply(req, "/trips", "nofirm", 403);
  if (reason.length < 3) return formReply(req, `/trips/${id}`, "reason");
  if (!(await store().cancelTrip(firm.id, id, reason))) return formReply(req, `/trips/${id}`, "transition", 409);
  return formReply(req, `/trips/${id}`);
}
