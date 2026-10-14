import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { tenant } from "@/lib/tenant";
export const dynamic = "force-dynamic";
/** Comutatorul „Date demo”: pornit = firma demo (doar citire), oprit = firma ta. */
export async function POST(req: Request) {
  const tn = await tenant(), f = tn.role === "owner" || tn.role === "admin" ? tn.firm : null; if (!f) return back(req, "/");
  const fd = await req.formData().catch(() => null);
  await store().updateFirm(f.id, { demoMode: fd?.get("on") === "1" });
  return back(req, "/");
}
