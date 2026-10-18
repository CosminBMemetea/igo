import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { driverTruck } from "@/lib/driver-access";
import { reportOperationFailure } from "@/lib/operation-error";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const tn = await tenant();
    if (tn.demo || tn.role !== "driver" || !tn.firm || !tn.uid) return NextResponse.json({ enabled: false }, { headers });
    const s = store(), user = await s.userById(tn.uid);
    if (!user?.truckId || !await driverTruck(s, tn, user.truckId)) return NextResponse.json({ enabled: false }, { headers });
    const shift = await s.shift(tn.firm.id, user.truckId);
    return NextResponse.json({ enabled: !!shift && !shift.end && !shift.privateSince, vehicleId: user.truckId, shiftStart: shift?.start ?? null }, { headers });
  } catch (e) { return NextResponse.json({ enabled: false, reference: reportOperationFailure("tracking-state", e) }, { status: 503, headers }); }
}
