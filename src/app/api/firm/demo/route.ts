import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
export const dynamic = "force-dynamic";
/** Comutatorul „Date demo”: pornit = firma demo (doar citire), oprit = firma ta. */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/");
  const fd = await req.formData().catch(() => null);
  await store().updateFirm(f.id, { demoMode: fd?.get("on") === "1" });
  return back(req, "/");
}
