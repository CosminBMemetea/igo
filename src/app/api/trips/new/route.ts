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
  const km = num(b.km, 1, 20000) ?? estimateKm(from, to);
  if (km == null) return NextResponse.json({ error: "km" }, { status: 400 });
  const tonnes = num(b.tonnes, 0, 60), revenue = num(b.revenue, 0, 10_000_000) ?? 0;
  const r = await s.addTrip(f.id, { truckId: truck.id, client, title: `${from} → ${to}`, date, km, revenue, litres: Math.round((km * (truck.normalL100 ?? DEFAULT_L100)) / 100), fuelPrice: FUEL_PRICE, tolls: 0, driverCost: 0, other: 0, litresSource: "estimate", driverId: drv?.id ?? null, tonnes, planned: true });
  return NextResponse.json({ ok: true, id: r.id, truck: truck.plate, driver: drv?.name ?? null });
}
