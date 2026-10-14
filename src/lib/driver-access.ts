import type { Tenant } from "./tenant";
import type { Store } from "./store/types";

/** The company boundary alone does not authorize a driver to operate another truck. */
export async function driverTruck(s: Store, tn: Pick<Tenant, "role" | "uid" | "firm" | "demo">, truckId: string): Promise<boolean> {
  if (tn.role !== "driver") return false;
  if (tn.demo) return !tn.firm;
  if (!tn.firm || !tn.uid) return false;
  const [u, trucks] = await Promise.all([s.userById(tn.uid), s.trucks(tn.firm.id)]);
  return !!u && !u.disabledAt && !!u.passwordHash && u.firmId === tn.firm.id && u.role === "driver" && u.truckId === truckId && trucks.some((t) => t.id === truckId && !t.archivedAt);
}
export async function driverTrip(s: Store, tn: Pick<Tenant, "role" | "uid" | "firm">, tripId: string): Promise<boolean> {
  if (!tn.firm) return false;
  const trip = (await s.trips(tn.firm.id)).find((t) => t.id === tripId);
  return !!trip && (tn.role === "owner" || tn.role === "admin" || (tn.role === "driver" && !!tn.uid && trip.driverId === tn.uid));
}
