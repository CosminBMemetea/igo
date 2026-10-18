import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { tripViews } from "@/lib/query";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import { demoLive } from "@/lib/live-sync";
import { realLive, nowMin } from "@/lib/real-live";
import { activeFleet } from "@/lib/econ-store";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const tn = await tenant(), r = tn.repo;
  const m = Number(new URL(req.url).searchParams.get("min"));
  const now = Number.isFinite(m) && m > 0 && m <= DEMO_NOW_MIN ? Math.round(m) : DEMO_NOW_MIN;
  const { vehicles, trips } = (await activeFleet(tn.demo, await r.vehicles(), await r.trips()));
  const list = tn.demo ? await demoLive(vehicles, tripViews(trips, vehicles), await r.parcels(), await r.zones(), now) : tn.firm ? await realLive(tn.firm.id, r, vehicles) : [];
  return NextResponse.json({ demo: tn.demo, minute: tn.demo ? now : nowMin(), vehicles: list }, { headers: { "Cache-Control": "private, no-store" } });
}
