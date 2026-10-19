import { writableFirm } from "@/lib/tenant";
import { store } from "@/lib/store";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export async function POST(req: Request) {
  const firm = await writableFirm();
  if (!firm) return formReply(req, "/drivers", "nofirm", 403);
  const id = clip((await req.formData()).get("id"), 60);
  const ok = await store().renewInvite(firm.id, id);
  return formReply(req, ok ? `/drivers?ok=1&inv=${encodeURIComponent(id)}#invite-${encodeURIComponent(id)}` : "/drivers", ok ? undefined : "missing", 404);
}
