import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { DEFAULT_L100 } from "@/lib/firm-repo";
import { clip, isDate, optNum } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?e=nofirm");
  const fd = await req.formData();
  const truckId = clip(fd.get("truck"), 60), client = clip(fd.get("client"), 120), title = clip(fd.get("title"), 120), date = clip(fd.get("date"), 10);
  const km = optNum(fd.get("km"), 1, 20000), revenue = optNum(fd.get("revenue"), 0, 10_000_000), litres = optNum(fd.get("litres"), 0, 20000);
  const fuelPrice = optNum(fd.get("fuelPrice"), 0.1, 50), tolls = optNum(fd.get("tolls"), 0, 1_000_000), driverCost = optNum(fd.get("driver"), 0, 1_000_000);
  if (!client || !title || !isDate(date) || km == null || revenue == null || fuelPrice == null || [km, revenue, litres, fuelPrice, tolls, driverCost].includes(undefined)) return back(req, "/setup?step=5&e=trip");
  const s = store();
  const truck = (await s.trucks(f.id)).find((t) => t.id === truckId);
  if (!truck) return back(req, "/setup?step=5&e=trip");
  // fără litri: estimăm din consumul normal (marcat în pagină ca estimare)
  const L = litres ?? Math.round((km! * (truck.normalL100 ?? DEFAULT_L100)) / 100);
  await s.addTrip(f.id, { truckId, client, title, date, km: km!, revenue: revenue!, litres: L, fuelPrice: fuelPrice!, tolls: tolls ?? 0, driverCost: driverCost ?? 0, other: 0, litresSource: litres == null ? "estimate" : "manual" });
  return back(req, "/setup?step=5&ok=1");
}
