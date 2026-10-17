import { driverTruck } from "@/lib/driver-access";
import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { localNow } from "@/lib/validate";
import { reportOperationFailure } from "@/lib/operation-error";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
/** Poziția din telefonul șoferului (doar în tură). Firmă reală: se salvează (folosită de regula „departe de camion”). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; lat?: unknown; lng?: unknown } | null;
  const ok = b && typeof b.vehicleId === "string" && typeof b.lat === "number" && typeof b.lng === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
  if (!ok) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const tn = await tenant();
  if (tn.role !== "driver") return NextResponse.json({ error: "role", role: tn.role }, { status: 409 });
  if (!(await driverTruck(store(), tn, b.vehicleId as string))) return NextResponse.json({ error: "assignment" }, { status: 403 });
  if (!tn.demo && tn.firm) {
    try {
      const accepted = await store().addDriverPosition(tn.firm.id, tn.uid!, { truckId: b.vehicleId as string, at: localNow(), lat: b.lat as number, lng: b.lng as number });
      if (!accepted) return NextResponse.json({ error: "tracking-inactive" }, { status: 409 });
    } catch (e) { return NextResponse.json({ error: "gps-unavailable", reference: reportOperationFailure("driver-position", e) }, { status: 503 }); }
  }
  return new NextResponse(null, { status: 204 });
}
