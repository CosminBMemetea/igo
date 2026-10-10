import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; action?: unknown; checklist?: unknown } | null;
  const r = repo();
  if (!b || typeof b.vehicleId !== "string" || !(await r.vehicles()).some((v) => v.id === b.vehicleId) || (b.action !== "start" && b.action !== "stop")) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const prev = await r.shift(b.vehicleId);
  const now = new Date().toISOString();
  const checklist = Array.isArray(b.checklist) ? b.checklist.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  const s = b.action === "start" ? await r.setShift({ vehicleId: b.vehicleId, start: now, end: null, checklist }) : await r.setShift({ vehicleId: b.vehicleId, start: prev?.start ?? now, end: now, checklist: prev?.checklist ?? [] });
  return NextResponse.json({ ok: true, shift: s });
}
