import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { getPrefs } from "@/lib/prefs";
import { commit, MAX_CSV_BYTES } from "@/lib/fuel/import";
import { demoResult, demoSandbox, isDemoImporter } from "@/lib/fuel/demo-import";
import type { Mapping } from "@/lib/fuel/parse";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  const f = await writableFirm();
  if (!f && !isDemoImporter()) return NextResponse.json({ error: "nofirm" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { text?: unknown; filename?: unknown; mapping?: Mapping; assign?: Record<string, string> } | null;
  if (!b || typeof b.text !== "string" || !b.text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (b.text.length > MAX_CSV_BYTES) return NextResponse.json({ error: "big" }, { status: 413 });
  const filename = typeof b.filename === "string" ? b.filename : "";
  if (!f) {
    // demo: import într-un MemStore de unică folosință; raportul și alertele se întorc direct, nu se salvează nimic
    const sb = await demoSandbox();
    const r = await commit(sb.s, sb.f.id, b.text, filename, b.mapping ?? undefined, b.assign ?? {});
    if (!r.ok) return NextResponse.json(r, { status: 422 });
    return NextResponse.json({ ...r, demo: await demoResult(sb.s, sb.f, getPrefs().loc) });
  }
  const r = await commit(store(), f.id, b.text, filename, b.mapping ?? undefined, b.assign ?? {});
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
