import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { parseSpeedSettings } from "@/lib/speed";
export const dynamic = "force-dynamic";
/** Limita de viteză setată de patron (implicit + per camion). Demo: blocat (writableFirm). */
export async function POST(req: Request) {
  const firm = await writableFirm();
  if (!firm) return back(req, "/settings?e=demo#speed");
  const fd = await req.formData(), ids = (await store().trucks(firm.id)).map(t => t.id), trucks: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("t_") && typeof v === "string") trucks[k.slice(2)] = v;
  const v = parseSpeedSettings({ limit: fd.get("limit"), over: fd.get("over"), after: fd.get("after"), alerts: fd.get("alerts"), trucks }, ids);
  if (!v) return back(req, "/settings?e=speed#speed");
  try { await store().setSpeedSettings(firm.id, v); } catch { return back(req, "/settings?e=speed#speed"); }
  return back(req, "/settings?ok=speed#speed");
}
