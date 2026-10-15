import { driverTrip, driverTruck } from "@/lib/driver-access";
import { logDriver } from "@/lib/driver-log";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { tenant } from "@/lib/tenant";
import type { TripEventKind } from "@/lib/store/types";
import { realToday, roIso } from "@/lib/demo-time";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
const KINDS: TripEventKind[] = ["loaded", "unloaded", "wait_start", "wait_end"];
/** Am încărcat / Am descărcat / Aștept la client (start/stop), cu ora și (opțional, cu acord, doar în tură) poziția. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { tripId?: unknown; kind?: unknown; lat?: unknown; lng?: unknown; key?: unknown; actorId?: unknown; occurredAt?: unknown } | null;
  if (!b || typeof b.tripId !== "string" || !KINDS.includes(b.kind as TripEventKind)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ms = typeof b.occurredAt === "string" ? Date.parse(b.occurredAt) : Date.now();
  const tn = await tenant();
  if (b.actorId && b.actorId !== tn.uid) return NextResponse.json({ error: "account" }, { status: 403 });
  if (tn.demo) {
    if (!(await tn.repo.trips()).some((t) => t.id === b.tripId)) return NextResponse.json({ error: "trip" }, { status: 404 });
    const base = Date.parse(roIso(realToday(), "14:00"));
    const demoMs = b.occurredAt == null ? base : ms;
    if (!Number.isFinite(demoMs) || demoMs < base - 300000 || demoMs > base + 86400000) return NextResponse.json({ error: "time" }, { status: 400 });
    return NextResponse.json({ at: new Date(demoMs).toISOString(), demo: true });
  }
  if (!tn.firm) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!Number.isFinite(ms) || ms > Date.now() + 300000 || ms < Date.now() - 30 * 86400000) return NextResponse.json({ error: "time" }, { status: 400 });
  const at = new Date(ms).toISOString();
  if (!(await driverTrip(store(), tn, b.tripId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ownTrip = (await store().trips(tn.firm.id)).find((t) => t.id === b.tripId)!;
  if (tn.role === "driver" && !(await driverTruck(store(), tn, ownTrip.truckId))) return NextResponse.json({ error: "assignment" }, { status: 403 });
  const shift = await tn.repo.shift(ownTrip.truckId);
  const geo = Date.now() - ms < 120000 && !!shift && !shift.end && !shift.privateSince && typeof b.lat === "number" && typeof b.lng === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
  const key = typeof b.key === "string" ? b.key : "";
  if (!/^[\w-]{8,100}$/.test(key)) return NextResponse.json({ error: "key" }, { status: 400 });
  try {
    const result = await store().recordTripEvent(tn.firm.id, { requestKey: key, tripId: b.tripId, kind: b.kind as TripEventKind, at, lat: geo ? b.lat as number : null, lng: geo ? b.lng as number : null, userId: tn.uid });
    if (!result.duplicate) await logDriver(tn, ownTrip.truckId, b.kind as TripEventKind, { note: ownTrip.title, at: result.event.at }).catch(() => {});
    return NextResponse.json({ ok: true, at: result.event.at, duplicate: result.duplicate });
  } catch (error) {
    if ((error as Error).message === "transition") return NextResponse.json({ error: "transition" }, { status: 409 });
    return NextResponse.json({ error: "server" }, { status: 503 });
  }
}
