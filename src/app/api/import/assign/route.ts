import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { normalizeCard, validCardId, validCardTime } from "@/lib/fuel/cards";
export const dynamic = "force-dynamic";
/** Add an effective card period; preserve all transactions outside it. */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/import?e=nofirm");
  const fd = await req.formData();
  const card = fd.get("card"), truckId = fd.get("truck"), validFrom = fd.get("from");
  if (typeof card !== "string" || !validCardId(normalizeCard(card)) || typeof truckId !== "string" || typeof validFrom !== "string" || !validCardTime(validFrom)) return back(req, "/import?e=assign#cards");
  try { await store().setCard(f.id, normalizeCard(card), truckId, validFrom); }
  catch (e) {
    const message = String((e as Error).message) + String((e as { cause?: Error }).cause?.message ?? "");
    const kind = message.includes("card-boundary-conflict") ? "boundary" : message.includes("card-plate-conflict") ? "plate" : "assign";
    return back(req, `/import?e=${kind}#cards`);
  }
  return back(req, "/import?assigned=1#cards");
}
