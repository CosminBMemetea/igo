import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
export const dynamic = "force-dynamic";
/** Card necunoscut → camion (reținut pentru importurile următoare; mută și tranzacțiile existente). */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/import?e=nofirm");
  const fd = await req.formData();
  const card = clip(fd.get("card"), 40), truckId = clip(fd.get("truck"), 60);
  if (!card || !(await store().trucks(f.id)).some((t) => t.id === truckId)) return back(req, "/import?e=assign");
  await store().setCard(f.id, card, truckId);
  return back(req, "/import?assigned=1");
}
