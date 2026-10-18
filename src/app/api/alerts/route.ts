import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ demo: true, alerts: await (await tenant()).repo.alerts() }); }
