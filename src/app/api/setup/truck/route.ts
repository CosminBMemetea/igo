import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip, normPlate, normVin, optNum } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?e=nofirm");
  const fd = await req.formData();
  const plate = normPlate(clip(fd.get("plate"), 20)), vin = normVin(clip(fd.get("vin"), 30));
  const tankL = optNum(fd.get("tank"), 20, 2000), normalL100 = optNum(fd.get("l100"), 5, 80);
  if (!plate) return back(req, "/setup?step=2&e=plate");
  if (vin === undefined) return back(req, "/setup?step=2&e=vin");
  if (tankL === undefined || normalL100 === undefined) return back(req, "/setup?step=2&e=num");
  try { await store().addTruck(f.id, { plate, vin, model: clip(fd.get("model"), 60) || null, tankL: tankL == null ? null : Math.round(tankL), normalL100 }); }
  catch { return back(req, "/setup?step=2&e=dup"); }
  return back(req, "/setup?step=2&ok=1");
}
