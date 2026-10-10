import { NextResponse } from "next/server";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
/** Poziția din telefonul șoferului (doar în tură). v1: validăm și confirmăm; stocarea vine cu Postgres. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; lat?: unknown; lng?: unknown } | null;
  const ok = b && typeof b.vehicleId === "string" && typeof b.lat === "number" && typeof b.lng === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "bad request" }, { status: 400 });
}
