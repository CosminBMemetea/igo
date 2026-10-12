import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
/** „Privat” în pauză (doar în tură): oprește salvarea pozițiilor până la revenire. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { vehicleId?: unknown; on?: unknown } | null;
  if (!b || typeof b.vehicleId !== "string" || typeof b.on !== "boolean") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const r = (await tenant()).repo;
  if (!(await r.vehicles()).some((v) => v.id === b.vehicleId)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sh = await r.shift(b.vehicleId);
  if (!sh || sh.end) return NextResponse.json({ error: "no shift" }, { status: 409 });
  const s = await r.setShift({ ...sh, privateSince: b.on ? new Date().toISOString() : null });
  return NextResponse.json({ ok: true, private: !!s.privateSince });
}
