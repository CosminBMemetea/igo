import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip, normPlate, optNum } from "@/lib/validate";
export const dynamic = "force-dynamic";
/** Editare camion pe loc (Setări): număr, model, rezervor, normă. */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/settings?e=nofirm");
  const fd = await req.formData(), id = clip(fd.get("id"), 60);
  const plate = normPlate(clip(fd.get("plate"), 20)), tankL = optNum(fd.get("tank"), 20, 2000), normalL100 = optNum(fd.get("l100"), 5, 80);
  if (!plate) return back(req, `/settings?e=plate&t=${id}#trucks`);
  if (tankL === undefined || normalL100 === undefined) return back(req, `/settings?e=num&t=${id}#trucks`);
  try { await store().updateTruck(f.id, id, { plate, model: clip(fd.get("model"), 60) || null, tankL: tankL == null ? null : Math.round(tankL), normalL100 }); }
  catch { return back(req, `/settings?e=dup&t=${id}#trucks`); }
  return back(req, "/settings?ok=truck#trucks");
}
