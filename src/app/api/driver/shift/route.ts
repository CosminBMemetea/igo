import { driverTruck } from "@/lib/driver-access";
import { validShiftChecklist } from "@/lib/shift-checklist";
import { logDriver } from "@/lib/driver-log";
import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { demoShift, saveDemoShift } from "@/lib/demo-shift";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; action?: unknown; checklist?: unknown; expectedShiftStart?: unknown } | null;
  const tn = await tenant(), r = tn.repo;
  if (tn.role !== "driver") return NextResponse.json({ error: "role", role: tn.role }, { status: 409 });
  if (!b || typeof b.vehicleId !== "string" || !(await r.vehicles()).some((v) => v.id === b.vehicleId) || (b.action !== "start" && b.action !== "stop")) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (!(await driverTruck(store(), tn, b.vehicleId))) return NextResponse.json({ error: "assignment" }, { status: 403 });
  const prev = (tn.demo ? (await demoShift(b.vehicleId)) : null) ?? await r.shift(b.vehicleId);
  const mobile = req.headers.get("authorization")?.startsWith("Bearer ");
  if (b.action === "stop" && (mobile || b.expectedShiftStart !== undefined)) {
    if (typeof b.expectedShiftStart !== "string" || !b.expectedShiftStart) return NextResponse.json({ error: "shift-required" }, { status: 400 });
    if (prev?.start !== b.expectedShiftStart) return NextResponse.json({ error: "stale-shift" }, { status: 409 });
  }
  if (b.action === "start" && prev && !prev.end) return NextResponse.json({ ok: true, shift: prev });
  if (b.action === "stop" && (!prev || prev.end)) return NextResponse.json({ ok: true, shift: prev });
  if (b.action === "start" && !validShiftChecklist(b.checklist)) return NextResponse.json({ error: "checklist" }, { status: 400 });
  const now = new Date().toISOString();
  const checklist = Array.isArray(b.checklist) ? b.checklist.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  const next = b.action === "start" ? { vehicleId: b.vehicleId, start: now, end: null, checklist, privateSince: null } : { vehicleId: b.vehicleId, start: prev?.start ?? now, end: now, checklist: prev?.checklist ?? [], privateSince: null };
  // demo: starea turei stă doar în cookie-ul vizitatorului, nu în memoria comună
  let s;
  try { s = tn.demo ? next : await r.setShift(next); }
  catch { return NextResponse.json({ error: "shift-conflict" }, { status: 409 }); }
  await logDriver(tn, b.vehicleId, b.action === "start" ? "shift_start" : "shift_end");
  const res = NextResponse.json({ ok: true, shift: s });
  return tn.demo ? (await saveDemoShift(res, s, prev)) : res;
}
