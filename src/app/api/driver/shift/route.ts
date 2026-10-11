import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; action?: unknown; checklist?: unknown } | null;
  const tn = await tenant(), r = tn.repo;
  if (!b || typeof b.vehicleId !== "string" || !(await r.vehicles()).some((v) => v.id === b.vehicleId) || (b.action !== "start" && b.action !== "stop")) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const prev = await r.shift(b.vehicleId);
  const now = new Date().toISOString();
  const checklist = Array.isArray(b.checklist) ? b.checklist.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  const s = b.action === "start" ? await r.setShift({ vehicleId: b.vehicleId, start: now, end: null, checklist }) : await r.setShift({ vehicleId: b.vehicleId, start: prev?.start ?? now, end: now, checklist: prev?.checklist ?? [] });
  // camionul curent al șoferului: primește și notificările despre documentele camionului
  if (b.action === "start" && !tn.demo && tn.firm && tn.role === "driver" && tn.uid) await store().setUserTruck(tn.firm.id, tn.uid, b.vehicleId).catch(() => null);
  return NextResponse.json({ ok: true, shift: s });
}
