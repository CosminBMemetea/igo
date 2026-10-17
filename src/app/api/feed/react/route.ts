import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { addDemoReaction } from "@/lib/demo-shift";
export const dynamic = "force-dynamic";
/** 👏 de la patron pentru un moment din flux. Demo: doar în cookie-ul sesiunii demo (șoferul îl vede pe /driver în același browser). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { id?: unknown; vehicleId?: unknown; label?: unknown; on?: unknown } | null;
  if (!b || typeof b.id !== "string" || typeof b.vehicleId !== "string" || b.id.length > 80) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const tn = await tenant();
  if (!tn.demo || tn.role === "driver") return NextResponse.json({ error: "demo only" }, { status: 409 });
  const res = NextResponse.json({ ok: true });
  (await addDemoReaction(res, { id: b.id, v: b.vehicleId, l: String(b.label ?? "").slice(0, 90), on: b.on !== false }));
  return res;
}
