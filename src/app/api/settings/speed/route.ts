import { NextResponse } from "next/server";
import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { parseSpeedSettings } from "@/lib/speed";
export const dynamic = "force-dynamic";

const wantsJson = (req: Request) => (req.headers.get("content-type") ?? "").includes("application/json") || (req.headers.get("accept") ?? "").includes("application/json");
/** Corpul cererii ca obiect simplu: formular (HTML) sau JSON. null = corp ilizibil → 400, niciodată 500. */
async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const j: unknown = await req.json();
      if (!j || typeof j !== "object" || Array.isArray(j)) return null;
      const o = j as Record<string, unknown>, trucks: Record<string, unknown> = o.trucks && typeof o.trucks === "object" && !Array.isArray(o.trucks) ? { ...(o.trucks as Record<string, unknown>) } : {};
      return { limit: o.limit, over: o.over, after: o.after, alerts: o.alerts, trucks };
    }
    const fd = await req.formData(), trucks: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith("t_") && typeof v === "string") trucks[k.slice(2)] = v;
    return { limit: fd.get("limit"), over: fd.get("over"), after: fd.get("after"), alerts: fd.get("alerts"), trucks };
  } catch { return null; }
}
/** Limita de viteză setată de patron (implicit + per camion). Demo: blocat (writableFirm). Acceptă formular sau JSON. */
export async function POST(req: Request) {
  const json = wantsJson(req), fail = (error: string, status: number, dest: string) => json ? NextResponse.json({ error }, { status }) : back(req, dest);
  const firm = await writableFirm();
  if (!firm) return fail("demo", 403, "/settings?e=demo#speed");
  const body = await readBody(req);
  if (!body) return fail("invalid", 400, "/settings?e=speed#speed");
  const ids = (await store().trucks(firm.id)).map(t => t.id);
  const v = parseSpeedSettings(body as Parameters<typeof parseSpeedSettings>[0], ids);
  if (!v) return fail("invalid", 400, "/settings?e=speed#speed");
  try { await store().setSpeedSettings(firm.id, v); } catch { return fail("save", 500, "/settings?e=speed#speed"); }
  return json ? NextResponse.json({ ok: true }) : back(req, "/settings?ok=speed#speed");
}
