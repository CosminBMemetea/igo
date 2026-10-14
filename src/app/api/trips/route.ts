import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { monthSummary, tripViews } from "@/lib/query";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function GET() {
  const tn = await tenant(), r = tn.repo;
  const views = tripViews(await r.trips(), await r.vehicles());
  return NextResponse.json({ demo: tn.demo, summary: monthSummary(views), trips: views.map(({ vehicle, ...x }) => ({ ...x, vehicle: vehicle.name })) });
}
