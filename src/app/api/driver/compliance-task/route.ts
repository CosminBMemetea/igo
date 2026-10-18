import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const tn = await tenant(), dest = "/driver#tasks";
  if (tn.demo || tn.role !== "driver" || !tn.firm || !tn.uid) return formReply(req, dest, "nofirm", 403);
  const fd = await req.formData();
  if (!await store().updateComplianceTask(tn.firm.id, clip(fd.get("id"), 60), "acknowledged", tn.uid)) return formReply(req, dest, "missing", 409);
  return formReply(req, dest);
}
