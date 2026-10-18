import { currentDocument, roadRegime, type ComplianceDoc, type VehicleCompliance } from "./compliance";
import type { Doc, Vehicle } from "./fleet/seed";
/** Active subjects only; one currently effective document per target/type. A future
 * renewal does not silence an expired current policy before that renewal starts. */
export function reminderDocuments<T extends ComplianceDoc & { truckId: string | null; userId?: string | null }>(docs: T[], trucks: { id: string; archivedAt?: string | null; compliance?: VehicleCompliance | null }[], users: { id: string; disabledAt?: string | null }[], today: string) {
  const activeTrucks = new Set(trucks.filter(t => !t.archivedAt).map(t => t.id));
  const activeUsers = new Set(users.filter(u => !u.disabledAt).map(u => u.id));
  const groups = new Map<string, T[]>();
  for (const d of docs) {
    if (d.truckId ? !activeTrucks.has(d.truckId) : !d.userId || !activeUsers.has(d.userId)) continue;
    if (d.type === "vignette" && roadRegime(trucks.find(t => t.id === d.truckId)?.compliance) === "tollro") continue;
    if (d.validFrom && d.validFrom > today) continue;
    const key = `${d.truckId ? "truck:" + d.truckId : "user:" + d.userId}:${d.type}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.values()].map(ds => currentDocument(ds, today)).filter((d): d is T => !!d);
}

/** Repository adapter shared by the home summary and alert list. */
export function currentRecordDocuments(docs: Doc[], vehicles: Vehicle[], today: string, users?: { id: string; disabledAt?: string | null }[]) {
  return reminderDocuments(
    docs.filter(d => d.scope !== "trip").map(d => ({ ...d, truckId: d.scope === "vehicle" ? d.ownerId : null, userId: d.scope === "driver" ? d.userId ?? d.ownerId : null })),
    vehicles.map(v => ({ id: v.id, archivedAt: v.archived ? "archived" : null, compliance: v.compliance })),
    users ?? docs.filter(d => d.scope === "driver").map(d => ({ id: d.userId ?? d.ownerId })), today,
  );
}
