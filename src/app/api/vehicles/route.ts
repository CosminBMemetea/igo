import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
export const dynamic = "force-dynamic";
export async function GET() { const tn = await tenant(); return NextResponse.json({ demo: tn.demo, vehicles: await tn.repo.vehicles() }); }
