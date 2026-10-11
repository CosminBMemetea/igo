import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ demo: true, vehicles: await (await tenant()).repo.vehicles() }); }
