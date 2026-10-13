import { NextResponse } from "next/server";
import { localNow } from "@/lib/validate";
import { tenant } from "@/lib/tenant";
import { addDemoFill, saveDemoFill } from "@/lib/demo-shift";
import { normCur, toRon } from "@/lib/fuel/fx";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
const MAX_PHOTO = 6 * 1024 * 1024;
export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "form" }, { status: 400 });
  const tn = await tenant(), r = tn.repo;
  // rolul se verifică la trimitere: un tab vechi de șofer, după ce în alt tab s-a logat patronul, nu trimite bonuri în numele lui
  if (tn.role !== "driver") return NextResponse.json({ error: "role", role: tn.role }, { status: 409 });
  const vehicleId = String(fd.get("vehicleId") ?? "");
  const litres = Number(fd.get("litres")), odometerKm = Number(fd.get("odometerKm")), amountRaw = String(fd.get("amount") ?? "").trim();
  const v = (await r.vehicles()).find((x) => x.id === vehicleId);
  if (!v || !(litres > 0) || litres > 2000 || !(odometerKm > 0) || odometerKm > 5_000_000) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > MAX_PHOTO) return NextResponse.json({ error: "photo too large" }, { status: 413 });
  const amount = amountRaw ? Number(amountRaw) : null;
  // monedă străină: curs BCE la data bonului (sau azi), prin EUR → RON; fără curs → suma originală, fără lei
  const currency = normCur(fd.get("currency")) ?? "RON", rDate = String(fd.get("date") ?? ""), day = /^\d{4}-\d{2}-\d{2}$/.test(rDate) ? rDate : localNow().slice(0, 10);
  const fx = amount != null && amount > 0 && currency !== "RON" ? await toRon(amount, currency, day) : null;
  const fxCols = currency === "RON" ? { currency: null, amountRon: null, fxRate: null, fxDate: null } : { currency, amountRon: fx?.ron ?? null, fxRate: fx?.rate ?? null, fxDate: fx?.fxDate ?? null };
  // demo: nimic în memoria comună a serverului; doar „ultima alimentare” în cookie-ul vizitatorului
  if (tn.demo) {
    const st = String(fd.get("station") ?? "").trim().slice(0, 80);
    const a = amount != null && amount > 0 ? amount : null;
    const res = NextResponse.json({});
    const { dup, id } = addDemoFill(res, { v: vehicleId, t: localNow().slice(0, 16), l: litres, o: odometerKm, a: fxCols.currency ? fx?.ron ?? null : a, c: fxCols.currency ? currency : null, r: fxCols.currency ? a : null, s: st, p: photo instanceof File && photo.size > 0 ? 1 : 0 });
    const out = NextResponse.json({ ok: true, demo: true, id, overTank: litres > v.tankL, fx: fxCols.currency ? { ...fxCols, ok: !!fx } : null });
    for (const c of res.cookies.getAll()) out.cookies.set(c);
    if (dup) return saveDemoFill(NextResponse.json({ ok: true, demo: true, dup: true, overTank: litres > v.tankL }), vehicleId, litres, st);
    return saveDemoFill(out, vehicleId, litres, st);
  }
  // idempotent: același bon (vehicul + litri + km la bord) trimis de două ori → aceeași alimentare, nu un duplicat
  const dup = (await r.driverFills(vehicleId)).find((x) => x.litres === litres && x.odometerKm === odometerKm);
  if (dup) return NextResponse.json({ ok: true, fill: dup, dup: true, overTank: litres > v.tankL });
  const row = await r.addDriverFill({ vehicleId, time: localNow(), litres, odometerKm, amount: amount != null && amount > 0 ? amount : null, ...fxCols, station: String(fd.get("station") ?? "").trim().slice(0, 80), photo: photo instanceof File ? { name: photo.name.slice(0, 80), size: photo.size } : null, aiRead: fd.get("aiRead") === "true" });
  return NextResponse.json({ ok: true, fill: row, overTank: litres > v.tankL, fx: fxCols.currency ? { ...fxCols, ok: !!fx } : null });
}
