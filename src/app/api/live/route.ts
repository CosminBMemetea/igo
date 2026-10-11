import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { liveFleet, tripViews } from "@/lib/query";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const r = (await tenant()).repo;
  const m = Number(new URL(req.url).searchParams.get("min"));
  const now = Number.isFinite(m) && m > 0 && m <= DEMO_NOW_MIN ? Math.round(m) : DEMO_NOW_MIN;
  const vehicles = await r.vehicles();
  return NextResponse.json({ demo: true, minute: now, vehicles: liveFleet(vehicles, tripViews(await r.trips(), vehicles), await r.parcels(), await r.zones(), now) });
}
