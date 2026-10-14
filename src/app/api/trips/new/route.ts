import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { DEFAULT_L100 } from "@/lib/firm-repo";
import { FUEL_PRICE } from "@/lib/fleet/seed";
import { estimateKm } from "@/lib/trip-new";
import { isDate } from "@/lib/validate";
export const dynamic = "force-dynamic";
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const num = (v: unknown, lo: number, hi: number) => { const x = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : NaN; return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };
/** „+ Cursă nouă”: cursa e atribuită șoferului; camionul vine din camionul lui curent (se poate schimba). */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return NextResponse.json({ error: "nofirm" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "bad" }, { status: 400 });
  const from = str(b.from, 60), to = str(b.to, 60), date = str(b.date, 10), client = str(b.client, 120) || "—";
  if (!from || !to) return NextResponse.json({ error: "route" }, { status: 400 });
  if (!isDate(date)) return NextResponse.json({ error: "date" }, { status: 400 });
  const s = store(), [trucks, users] = await Promise.all([s.trucks(f.id), s.users(f.id)]);
  const drv = users.find((u) => u.id === b.driverId && u.role === "driver" && !u.disabledAt) ?? null;
  if (b.driverId && !drv) return NextResponse.json({ error: "driver" }, { status: 400 });
  const live = trucks.filter((t) => !t.archivedAt);
  const truck = b.truckId ? live.find((t) => t.id === b.truckId) : live.find((t) => t.id === drv?.truckId); // Never silently assign an unrelated vehicle.
  if (drv && truck && drv.truckId !== truck.id) return NextResponse.json({ error: "driver" }, { status: 400 });
  if (!truck) return NextResponse.json({ error: "truck" }, { status: 400 });
  const km = b.km == null || b.km === "" ? estimateKm(from, to) : num(b.km, 1, 20000);
  if (km == null) return NextResponse.json({ error: "km" }, { status: 400 });
  const tonnes = num(b.tonnes, 0, 60), revenue = num(b.revenue, 0, 10_000_000) ?? 0;
  if ((b.tonnes != null && b.tonnes !== "" && tonnes === null) || (b.revenue != null && b.revenue !== "" && num(b.revenue, 0, 10_000_000) === null)) return NextResponse.json({ error: "num" }, { status: 400 });
  const key = b.key == null ? null : typeof b.key === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(b.key) ? b.key : "";
  if (key === "") return NextResponse.json({ error: "bad" }, { status: 400 });
  const id = str(b.id, 80), previous = id ? (await s.trips(f.id)).find((t) => t.id === id) : null;
  if (id && (!previous || !previous.planned || previous.loadedAt || previous.cancelledAt)) return NextResponse.json({ error: "closed" }, { status: 409 });
  const payload = { truckId: truck.id, client, title: `${from} → ${to}`, date, km, revenue, litres: previous?.litresSource === "manual" ? previous.litres : Math.round((km * (truck.normalL100 ?? DEFAULT_L100)) / 100), fuelPrice: previous?.fuelPrice ?? FUEL_PRICE, tolls: previous?.tolls ?? 0, driverCost: previous?.driverCost ?? 0, other: previous?.other ?? 0, litresSource: previous?.litresSource ?? "estimate" as const, driverId: drv?.id ?? null, tonnes, planned: true };
  if (id) {
    if (!(await s.editPlannedTrip(f.id, id, payload))) return NextResponse.json({ error: "closed" }, { status: 409 });
    return NextResponse.json({ ok: true, id });
  }
  try {
    const requestHash = key ? createHash("sha256").update(JSON.stringify(payload)).digest("hex") : null;
    const r = await s.addTrip(f.id, { ...payload, requestKey: key, requestHash });
    return NextResponse.json({ ok: true, id: r.id, truck: truck.plate, driver: drv?.name ?? null });
  } catch (err) {
    if (err instanceof Error && err.message === "request_conflict") return NextResponse.json({ error: "conflict" }, { status: 409 });
    throw err;
  }
}
