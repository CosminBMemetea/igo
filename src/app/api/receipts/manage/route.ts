import { store } from "@/lib/store";
import { writableFirm, tenant } from "@/lib/tenant";
import { clip, optNum } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
import { deleteStoredFile } from "@/lib/files";
export const dynamic = "force-dynamic";
/** Owner edits or deletes a driver-entered receipt. Fuel alerts are derived from receipts, so they recompute on the next render. */
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData(), dest = "/receipts";
  if (!f) return formReply(req, dest, "nofirm", 403);
  const id = clip(fd.get("id"), 60), s = store(), who = (await tenant()).uid;
  if (fd.get("action") === "delete") {
    const r = await s.deleteDriverFuel(f.id, id); if (!r) return formReply(req, dest, "missing", 404);
    if (r.photoName?.startsWith("file:")) await deleteStoredFile(s, f.id, r.photoName.slice(5)).catch(() => false);
    console.info(JSON.stringify({ audit: "receipt.delete", firm: f.id, by: who, id, litres: r.litres, amount: r.amount, at: r.at }));
    return formReply(req, `${dest}?ok=1`);
  }
  const litres = optNum(fd.get("litres"), 0.1, 2000), amount = optNum(fd.get("amount"), 0, 1_000_000), odometer = optNum(fd.get("odometer"), 0, 5_000_000);
  if (litres == null || litres === undefined || amount === undefined || odometer === undefined) return formReply(req, dest, "num");
  const r = await s.updateDriverFuel(f.id, id, { litres, amount, odometer: odometer == null ? null : Math.round(odometer), station: clip(fd.get("station"), 80) });
  if (!r) return formReply(req, dest, "missing", 404);
  console.info(JSON.stringify({ audit: "receipt.edit", firm: f.id, by: who, id, litres, amount, odometer }));
  return formReply(req, `${dest}?ok=1`);
}
