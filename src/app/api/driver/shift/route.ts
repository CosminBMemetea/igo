import { localNow } from "@/lib/validate";
import { logDriver } from "@/lib/driver-log";
import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { demoShift, saveDemoShift } from "@/lib/demo-shift";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; action?: unknown; checklist?: unknown } | null;
  const tn = await tenant(), r = tn.repo;
  if (tn.role !== "driver") return NextResponse.json({ error: "role", role: tn.role }, { status: 409 });
  if (!b || typeof b.vehicleId !== "string" || !(await r.vehicles()).some((v) => v.id === b.vehicleId) || (b.action !== "start" && b.action !== "stop")) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const prev = (tn.demo ? demoShift(b.vehicleId) : null) ?? await r.shift(b.vehicleId);
  const now = new Date().toISOString();
  const checklist = Array.isArray(b.checklist) ? b.checklist.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  const next = b.action === "start" ? { vehicleId: b.vehicleId, start: now, end: null, checklist, privateSince: null } : { vehicleId: b.vehicleId, start: prev?.start ?? now, end: now, checklist: prev?.checklist ?? [], privateSince: null };
  // demo: starea turei stă doar în cookie-ul vizitatorului, nu în memoria comună
  const s = tn.demo ? next : await r.setShift(next);
  // camionul curent al șoferului: primește și notificările despre documentele camionului
  if (b.action === "start" && !tn.demo && tn.firm && tn.role === "driver" && tn.uid) {
    const st = store(), me = await st.userById(tn.uid).catch(() => null), from = me?.truckId ?? null;
    await st.setUserTruck(tn.firm.id, tn.uid, b.vehicleId).catch(() => null);
    if (from !== b.vehicleId) {
      // istoric șofer → camion + eveniment în fluxul patronului; cursele lui de azi trec pe camionul folosit efectiv
      await st.addAssignment(tn.firm.id, { userId: tn.uid, truckId: b.vehicleId, fromTruckId: from }).catch(() => null);
      const plate = (await r.vehicles()).find((v) => v.id === b.vehicleId)?.name ?? "";
      if (from) await logDriver(tn, b.vehicleId, "truck_switch", { note: plate });
      const today = localNow().slice(0, 10);
      for (const t of (await st.trips(tn.firm.id)).filter((x) => x.driverId === tn.uid && x.date === today && x.truckId !== b.vehicleId)) await st.setTripTruck(tn.firm.id, t.id, b.vehicleId).catch(() => null);
    }
  }
  await logDriver(tn, b.vehicleId, b.action === "start" ? "shift_start" : "shift_end");
  const res = NextResponse.json({ ok: true, shift: s });
  return tn.demo ? saveDemoShift(res, s) : res;
}
