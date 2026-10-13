import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { localNow } from "@/lib/validate";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
/** Poziția din telefonul șoferului (doar în tură). Firmă reală: se salvează (folosită de regula „departe de camion”). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; lat?: unknown; lng?: unknown } | null;
  const ok = b && typeof b.vehicleId === "string" && typeof b.lat === "number" && typeof b.lng === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
  if (!ok) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const tn = await tenant();
  if (tn.role !== "driver") return NextResponse.json({ error: "role", role: tn.role }, { status: 409 });
  if (!tn.demo && tn.firm) {
    const sh = await tn.repo.shift(b.vehicleId as string);
    if (!sh || sh.end) return NextResponse.json({ error: "no shift" }, { status: 409 });
    // GDPR: în modul privat nu se salvează nimic
    if (sh.privateSince) return NextResponse.json({ error: "private" }, { status: 409 });
    try { await store().addPosition(tn.firm.id, { truckId: b.vehicleId as string, at: localNow(), lat: b.lat as number, lng: b.lng as number }); }
    catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  }
  return new NextResponse(null, { status: 204 });
}
