import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { driverTripSummary, groupDriverTrips } from "@/lib/driver-trips";
import { localNow } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function GET() {
  const tn = await tenant();
  if (tn.demo || tn.role !== "driver" || !tn.uid || !tn.firm) return NextResponse.json({ error: "driver-required" }, { status: 403 });
  const s = store(), u = await s.userById(tn.uid);
  const truck = (await s.trucks(tn.firm.id)).find(t => t.id === u?.truckId && !t.archivedAt);
  const shift = truck ? await s.shift(tn.firm.id, truck.id) : null;
  const trips = (await s.trips(tn.firm.id)).filter(t => t.driverId === tn.uid).map(driverTripSummary);
  return NextResponse.json({ name: u?.name, firm: tn.firm.name, truck: truck ? { id: truck.id, plate: truck.plate } : null,
    shift, trips: groupDriverTrips(trips, localNow().slice(0, 10)), serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } });
}
