import { store } from "@/lib/store";
import { driverTruck } from "@/lib/driver-access";
import { logDriver } from "@/lib/driver-log";
import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { demoShift, saveDemoShift } from "@/lib/demo-shift";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
/** „Privat” în pauză (doar în tură): oprește salvarea pozițiilor până la revenire. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; on?: unknown } | null;
  if (!b || typeof b.vehicleId !== "string" || typeof b.on !== "boolean") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const tn = await tenant(), r = tn.repo;
  if (tn.role !== "driver") return NextResponse.json({ error: "role", role: tn.role }, { status: 409 });
  if (!(await r.vehicles()).some((v) => v.id === b.vehicleId)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (!(await driverTruck(store(), tn, b.vehicleId))) return NextResponse.json({ error: "assignment" }, { status: 403 });
  const sh = (tn.demo ? demoShift(b.vehicleId) : null) ?? await r.shift(b.vehicleId);
  if (!sh || sh.end) return NextResponse.json({ error: "no shift" }, { status: 409 });
  // demo: doar în cookie-ul vizitatorului (nu în memoria comună a serverului — altfel s-ar vedea la alți vizitatori)
  const next = { ...sh, privateSince: b.on ? new Date().toISOString() : null };
  let s;
  try { s = tn.demo ? next : await r.setShift(next); }
  catch { return NextResponse.json({ error: "shift-conflict" }, { status: 409 }); }
  if (!!sh.privateSince !== b.on) await logDriver(tn, b.vehicleId, b.on ? "private_on" : "private_off");
  const res = NextResponse.json({ ok: true, private: !!s.privateSince });
  return tn.demo ? saveDemoShift(res, s) : res;
}
