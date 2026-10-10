import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ demo: true, vehicles: await repo().vehicles() }); }
