import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { tenant } from "@/lib/tenant";
import type { TripEventKind } from "@/lib/store/types";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
const KINDS: TripEventKind[] = ["loaded", "unloaded", "wait_start", "wait_end"];
/** Am încărcat / Am descărcat / Aștept la client (start/stop), cu ora și (opțional, cu acord, doar în tură) poziția. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { tripId?: unknown; kind?: unknown; lat?: unknown; lng?: unknown } | null;
  if (!b || typeof b.tripId !== "string" || !KINDS.includes(b.kind as TripEventKind)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const at = new Date().toISOString();
  const tn = await tenant();
  if (tn.demo || !tn.firm) return NextResponse.json({ at, demo: true });
  const geo = typeof b.lat === "number" && typeof b.lng === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
  try { const e = await store().addTripEvent(tn.firm.id, { tripId: b.tripId, kind: b.kind as TripEventKind, at, lat: geo ? (b.lat as number) : null, lng: geo ? (b.lng as number) : null, userId: tn.uid }); return NextResponse.json({ at: e.at }); }
  catch { return NextResponse.json({ error: "not found" }, { status: 404 }); }
}
