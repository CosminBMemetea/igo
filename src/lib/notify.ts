// Clopoțelul: notificările firmei (stocate de jobul zilnic) sau, pe demo, calculate din documentele demo.
import { DOCS } from "./fleet/seed";
import { dueReminders } from "./docs";
import { store } from "./store";
import type { Tenant } from "./tenant";
import type { NotificationRow } from "./store/types";
import { DEMO_TODAY } from "./today";

export async function notificationsFor(tn: Tenant): Promise<NotificationRow[]> {
  if (!tn.demo && tn.firm) return store().notifications(tn.firm.id, tn.role === "driver" ? tn.uid : null);
  if (tn.firm && !tn.demo) return [];
  const vehicles = await tn.repo.vehicles();
  const docs = DOCS.filter((d) => d.expires && d.scope !== "trip").map((d) => ({ id: d.id, type: d.type, expires: d.expires!, truckId: d.scope === "vehicle" ? d.ownerId : null, userId: d.scope === "driver" ? d.ownerId : null, label: d.scope === "vehicle" ? vehicles.find((v) => v.id === d.ownerId)?.name ?? d.ownerId : d.ownerId }));
  return dueReminders(docs, [], DEMO_TODAY).map((r, i) => {
    const d = docs.find((x) => x.id === r.docId)!;
    return { id: `demo-${i}`, firmId: "demo", userId: null, key: r.key, kind: r.stage, docId: r.docId, params: { type: d.type, label: d.label, expires: d.expires, days: r.days }, readAt: r.days > 14 ? "2026-10-01T06:00:00Z" : null, createdAt: `${DEMO_TODAY}T04:00:00Z` };
  });
}
