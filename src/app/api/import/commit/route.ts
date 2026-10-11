import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { commit, MAX_CSV_BYTES } from "@/lib/fuel/import";
import type { Mapping } from "@/lib/fuel/parse";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return NextResponse.json({ error: "nofirm" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { text?: unknown; filename?: unknown; mapping?: Mapping; assign?: Record<string, string> } | null;
  if (!b || typeof b.text !== "string" || !b.text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (b.text.length > MAX_CSV_BYTES) return NextResponse.json({ error: "big" }, { status: 413 });
  const r = await commit(store(), f.id, b.text, typeof b.filename === "string" ? b.filename : "", b.mapping ?? undefined, b.assign ?? {});
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
