import { reminderDocuments } from "./compliance-reminders";
import { realToday } from "./demo-time";
// Clopoțelul: notificările firmei (stocate de jobul zilnic) sau, pe demo, calculate din documentele demo.
import { dueReminders } from "./docs";
import { store } from "./store";
import type { Tenant } from "./tenant";
import type { NotificationRow } from "./store/types";

export async function notificationsFor(tn: Tenant): Promise<NotificationRow[]> {
  if (!tn.demo && tn.firm) {
    const s = store(), firmId = tn.firm.id;
    const [notifications, docs, trucks, users, tasks] = await Promise.all([s.notifications(firmId, tn.role === "driver" ? tn.uid : null), s.docs(firmId), s.trucks(firmId), s.users(firmId), s.complianceTasks(firmId)]);
    const active = new Map(reminderDocuments(docs, trucks, users, realToday()).map(d => [d.id, d]));
    const me = users.find(u => u.id === tn.uid);
    // Hide stale notices after renewal, reassignment or archive; keep the stored audit trail.
    return notifications.filter(n => {
      if (n.kind === "compliance-task") return tasks.some(task => task.id === n.params.taskId && ["open","acknowledged"].includes(task.status) && task.driverId === tn.uid && task.truckId === me?.truckId && trucks.some(t => t.id === task.truckId && !t.archivedAt));
      if (!n.docId) return true;
      const d = active.get(n.docId);
      return !!d && d.expires === n.params.expires && (tn.role !== "driver" || d.userId === tn.uid || (!!d.truckId && d.truckId === me?.truckId));
    });
  }
  if (tn.firm && !tn.demo) return [];
  const [vehicles, records] = await Promise.all([tn.repo.vehicles(), tn.repo.docs()]);
  const today = realToday();
  const candidates = records.filter(d => d.expires && d.scope !== "trip").map(d => ({ ...d, expires: d.expires!, truckId: d.scope === "vehicle" ? d.ownerId : null, userId: d.scope === "driver" ? d.ownerId : null, label: d.scope === "vehicle" ? vehicles.find(v => v.id === d.ownerId)?.name ?? d.ownerId : d.ownerId }));
  const docs = reminderDocuments(candidates, vehicles.map(v => ({ id: v.id, archivedAt: v.archived ? "archived" : null, compliance: v.compliance })), candidates.filter(d => d.userId).map(d => ({ id: d.userId! })), today).filter(d => tn.role !== "driver" || d.truckId === vehicles[0]?.id || d.userId === vehicles[0]?.driver);
  return dueReminders(docs, [], today).map((r, i) => {
    const d = docs.find((x) => x.id === r.docId)!;
    return { id: `demo-${i}`, firmId: "demo", userId: null, key: r.key, kind: r.stage, docId: r.docId, params: { type: d.type, label: d.label, expires: d.expires, days: r.days }, readAt: r.days > 14 ? `${today}T06:00:00Z` : null, createdAt: `${today}T04:00:00Z` };
  });
}
