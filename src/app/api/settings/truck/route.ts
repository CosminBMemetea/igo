import { parseCompliance } from "@/lib/compliance";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip, normPlate, normVin, optNum } from "@/lib/validate";
import { duplicateError, formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData(), id = clip(fd.get("id"), 60);
  const dest = fd.get("ret") === "/trucks" ? "/trucks" : "/settings";
  if (!f) return formReply(req, dest, "nofirm", 403);
  const plate = normPlate(clip(fd.get("plate"), 20)), tankL = optNum(fd.get("tank"), 20, 2000), normalL100 = optNum(fd.get("l100"), 5, 80);
  const vin = normVin(clip(fd.get("vin"), 30));
  const compliance = fd.has("category") ? parseCompliance(Object.fromEntries(fd)) : undefined;
  if (compliance === null) return formReply(req, dest, "classification");
  if (!plate) return formReply(req, dest, "plate");
  if (vin === undefined) return formReply(req, dest, "vin");
  if (tankL === undefined || normalL100 === undefined) return formReply(req, dest, "num");
  try {
    const ok = await store().updateTruck(f.id, id, { ...(compliance !== undefined ? { compliance } : {}), plate, ...(fd.has("vin") ? { vin } : {}), model: clip(fd.get("model"), 60) || null, tankL: tankL == null ? null : Math.round(tankL), normalL100 });
    if (!ok) return formReply(req, dest, "missing", 404);
  } catch (e) { return formReply(req, dest, duplicateError(e) ? "dup" : "server", duplicateError(e) ? 409 : 503); }
  return formReply(req, `${dest}?ok=truck`);
}
