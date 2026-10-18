import { createHash } from "node:crypto";
import { writableFirm } from "@/lib/tenant";
import { store } from "@/lib/store";
import { previewProfiles, PROFILE_HEADERS } from "@/lib/compliance-csv";
import { reportOperationFailure } from "@/lib/operation-error";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const firm = await writableFirm();
  if (!firm) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!req.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "json" }, { status: 415 });
  if (Number(req.headers.get("content-length")) > 300000) return Response.json({ error: "size" }, { status: 413 });
  try {
    const raw = await req.text(); if (raw.length > 300000) return Response.json({ error: "size" }, { status: 413 });
    const body = JSON.parse(raw);
    if (!body || typeof body.csv !== "string" || !["preview", "commit"].includes(body.mode)) return Response.json({ error: "csv" }, { status: 400 });
    const s = store(), preview = previewProfiles(body.csv, await s.trucks(firm.id));
    if (preview.errors.length) return Response.json({ error: "rows", rows: preview.errors }, { status: 400 });
    const canonical = preview.changes.map(c => [c.id, c.plate, c.previous ? PROFILE_HEADERS.slice(1).map(k => c.previous![k as keyof typeof c.previous]) : null, c.next]);
    const stamp = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
    if (body.mode === "preview") return Response.json({ stamp, changes: preview.changes });
    if (body.stamp !== stamp || !await s.updateComplianceBatch(firm.id, preview.changes)) return Response.json({ error: "stale" }, { status: 409 });
    return Response.json({ ok: true, count: preview.changes.length });
  } catch (e) {
    if (e instanceof SyntaxError || (e instanceof Error && ["csv", "size"].includes(e.message))) return Response.json({ error: "csv" }, { status: 400 });
    reportOperationFailure("compliance-import", e);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
