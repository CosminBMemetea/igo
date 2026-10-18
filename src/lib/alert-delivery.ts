import { appOrigin } from "./app-origin";
import type { Store, UserRow, DeliveryContext } from "./store/types";
import { queueEmail, type EmailProvider } from "./email";
import { tri, type Locale } from "./i18n";
export async function queuePush(s: Store, firmId: string, user: UserRow, key: string, context: DeliveryContext) {
  if (user.disabledAt || !user.passwordHash) return;
  for (const device of await s.pushDevices(firmId, user.id)) {
    if (device.sessionVersion !== (user.sessionVersion ?? 0)) continue;
    await s.addEmail({ firmId, key: `push:${key}:${device.id}`, channel: "push", subscriptionId: device.id, context, to: "", subject: "Querra Fleet", body: "", expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() });
  }
}
/** Reconciliation is intentionally repeatable: an interrupted enqueue is repaired on the next pass. */
export async function queueTaskAlerts(s: Store, firmId: string, email: EmailProvider | null = null) {
  const [tasks, users, trucks] = await Promise.all([s.complianceTasks(firmId), s.users(firmId), s.trucks(firmId)]);
  for (const task of tasks) {
    if (!["open", "acknowledged"].includes(task.status)) continue;
    const truck = trucks.find(t => t.id === task.truckId && !t.archivedAt), driver = users.find(u => u.id === task.driverId && !u.disabledAt && u.truckId === task.truckId);
    if (!truck || !driver) continue;
    const recipients = task.status === "open" ? [driver] : users.filter(u => u.role === "owner" && !u.disabledAt);
    for (const user of recipients) {
      const loc = (["ro", "en", "pl"].includes(user.locale ?? "") ? user.locale : "ro") as Locale;
      const key = `task:${task.id}:${task.status}:${user.id}`;
      const context: DeliveryContext = { kind: "task", userId: user.id, taskId: task.id, status: task.status };
      const subject = task.status === "open" ? tri(loc, "Verificare solicitată|Check requested|Prośba o sprawdzenie") : tri(loc, "Șoferul a preluat verificarea|Driver acknowledged the check|Kierowca potwierdził zadanie");
      if (task.status === "acknowledged") await s.addNotifications(firmId, [{ key: `task-ack:${task.id}`, userId: null, kind: "compliance-task-owner", docId: null, params: { taskId: task.id, label: truck.plate, type: task.type, expires: task.due } }]);
      if (user.email && user.emailAlerts !== false) await queueEmail(s, firmId, key, { to: user.email, subject: `${subject} · ${truck.plate}`, text: `${subject}\n${truck.plate} · ${task.type}\n${task.due}\n\n${appOrigin()}/notifications\n\nQuerra Fleet` }, email, { context, defer: true });
      await queuePush(s, firmId, user, key, context);
    }
  }
}
