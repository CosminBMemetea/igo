import { NextResponse } from "next/server";
import { localNow } from "@/lib/validate";
import { tenant } from "@/lib/tenant";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
const MAX_PHOTO = 6 * 1024 * 1024;
export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "form" }, { status: 400 });
  const r = (await tenant()).repo;
  const vehicleId = String(fd.get("vehicleId") ?? "");
  const litres = Number(fd.get("litres")), odometerKm = Number(fd.get("odometerKm")), amountRaw = String(fd.get("amount") ?? "").trim();
  const v = (await r.vehicles()).find((x) => x.id === vehicleId);
  if (!v || !(litres > 0) || litres > 2000 || !(odometerKm > 0) || odometerKm > 5_000_000) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > MAX_PHOTO) return NextResponse.json({ error: "photo too large" }, { status: 413 });
  const amount = amountRaw ? Number(amountRaw) : null;
  const row = await r.addDriverFill({ vehicleId, time: localNow(), litres, odometerKm, amount: amount != null && amount > 0 ? amount : null, station: String(fd.get("station") ?? "").slice(0, 80), photo: photo instanceof File ? { name: photo.name.slice(0, 80), size: photo.size } : null, aiRead: fd.get("aiRead") === "true" });
  return NextResponse.json({ ok: true, fill: row, overTank: litres > v.tankL });
}
