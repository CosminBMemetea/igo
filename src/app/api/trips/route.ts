import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { monthSummary, tripViews } from "@/lib/query";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function GET() {
  const r = repo();
  const views = tripViews(await r.trips(), await r.vehicles());
  return NextResponse.json({ demo: true, summary: monthSummary(views), trips: views.map(({ vehicle, ...x }) => ({ ...x, vehicle: vehicle.name })) });
}
