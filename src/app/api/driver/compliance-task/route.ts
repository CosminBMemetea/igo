import { after } from "next/server";
import { queueTaskAlerts } from "@/lib/alert-delivery";
import { drainDeliveries } from "@/lib/delivery";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  const tn = await tenant(), dest = "/driver#tasks";
  if (tn.demo || tn.role !== "driver" || !tn.firm || !tn.uid) return formReply(req, dest, "nofirm", 403);
  const fd = await req.formData();
  if (!await store().updateComplianceTask(tn.firm.id, clip(fd.get("id"), 60), "acknowledged", tn.uid)) return formReply(req, dest, "missing", 409);
  await queueTaskAlerts(store(), tn.firm.id);
  after(() => drainDeliveries(store()).then(() => {}));
  return formReply(req, dest);
}
