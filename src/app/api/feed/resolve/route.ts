import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { setDemoResolved, type ResAction } from "@/lib/demo-shift";
export const dynamic = "force-dynamic";
const OK: ResAction[] = ["confirm", "false", "upload", "ok"];
/** Rezolvarea unei avertizări din flux / din /alerts. Demo: doar în cookie-ul sesiunii demo, nimic în DB. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { id?: unknown; action?: unknown; note?: unknown } | null;
  if (!b || typeof b.id !== "string" || b.id.length > 80 || !/^[a-z]-[\w.-]+$/i.test(b.id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const a = b.action === null ? null : OK.includes(b.action as ResAction) ? (b.action as ResAction) : undefined;
  if (a === undefined) return NextResponse.json({ error: "bad action" }, { status: 400 });
  const tn = await tenant();
  if (!tn.demo || tn.role === "driver") return NextResponse.json({ error: "demo only" }, { status: 409 });
  const res = NextResponse.json({ ok: true });
  (await setDemoResolved(res, b.id, a, typeof b.note === "string" ? b.note.trim() : undefined));
  return res;
}
