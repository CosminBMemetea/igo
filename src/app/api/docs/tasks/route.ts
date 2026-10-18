import { after } from "next/server";
import { queueTaskAlerts } from "@/lib/alert-delivery";
import { drainDeliveries } from "@/lib/delivery";
import { writableFirm } from "@/lib/tenant";
import { store } from "@/lib/store";
import { clip, isDate } from "@/lib/validate";
import { VEHICLE_DOC_TYPES } from "@/lib/store/types";
import { formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  const firm = await writableFirm(), dest = "/documents#tasks";
  if (!firm) return formReply(req, dest, "nofirm", 403);
  const fd = await req.formData(), s = store(), id = clip(fd.get("id"), 60);
  if (id) {
    const status = fd.get("status");
    if (status !== "done" && status !== "cancelled") return formReply(req, dest, "transition");
    if (!await s.updateComplianceTask(firm.id, id, status)) return formReply(req, dest, "missing", 409);
  } else {
    const type = clip(fd.get("type"), 25), due = clip(fd.get("due"), 10), truckId = clip(fd.get("truckId"), 60);
    if (![...VEHICLE_DOC_TYPES, "tollro", "classification"].includes(type) || !isDate(due)) return formReply(req, dest, "classification");
    const users = await s.users(firm.id), driver = users.find(u => u.role === "driver" && !u.disabledAt && u.truckId === truckId);
    if (!driver) return formReply(req, dest, "task-driver");
    const task = await s.addComplianceTask(firm.id, { truckId, driverId: driver.id, type, due });
    if (!task || task.driverId !== driver.id) return formReply(req, dest, "task-driver", 409);
    if (task.due !== due) return formReply(req, dest, "task-exists", 409);
    const truck = (await s.trucks(firm.id)).find(t => t.id === truckId);
    await s.addNotifications(firm.id, [{ key: `compliance-task:${task.id}`, kind: "compliance-task", userId: task.driverId, docId: null, params: { taskId: task.id, type, label: truck?.plate ?? "", expires: task.due } }]);
  }
  await queueTaskAlerts(store(), firm.id);
  after(() => drainDeliveries(store()).then(() => {}));
  return formReply(req, dest);
}
