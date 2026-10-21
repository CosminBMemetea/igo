import { driverTruck } from "@/lib/driver-access";
import { store } from "@/lib/store";
import { saveFile, deleteStoredFile } from "@/lib/files";
import { logDriver } from "@/lib/driver-log";
import { NextResponse } from "next/server";
import { localNow, isDate, clipChars, decNum, LITRES_MIN, LITRES_MAX, AMOUNT_MAX } from "@/lib/validate";
import { tenant } from "@/lib/tenant";
import { addDemoFill, saveDemoFill } from "@/lib/demo-shift";
import { normCur, toRon } from "@/lib/fuel/fx";
export const dynamic = "force-dynamic";
const MAX_PHOTO = 2 * 1024 * 1024;
export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "form" }, { status: 400 });
  const tn = await tenant(), r = tn.repo;
  if (fd.get("actorId") && fd.get("actorId") !== tn.uid) return NextResponse.json({ error: "account" }, { status: 403 });
  // rolul se verifică la trimitere: un tab vechi de șofer, după ce în alt tab s-a logat patronul, nu trimite bonuri în numele lui
  if (tn.role !== "driver") return NextResponse.json({ error: "role", role: tn.role }, { status: 409 });
  const vehicleId = String(fd.get("vehicleId") ?? "");
  if (!(await driverTruck(store(), tn, vehicleId))) return NextResponse.json({ error: "assignment" }, { status: 403 });
  const litres = decNum(String(fd.get("litres") ?? "")), odometerKm = decNum(String(fd.get("odometerKm") ?? "")), amountRaw = String(fd.get("amount") ?? "").trim();
  const v = (await r.vehicles()).find((x) => x.id === vehicleId);
  if (!v || !(litres >= LITRES_MIN) || litres > LITRES_MAX || !(odometerKm > 0) || odometerKm > 5_000_000) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > MAX_PHOTO) return NextResponse.json({ error: "photo too large" }, { status: 413 });
  const amount = amountRaw ? decNum(amountRaw) : null;
  if (amount !== null && amount > AMOUNT_MAX) return NextResponse.json({ error: "amount-big" }, { status: 400 });
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) return NextResponse.json({ error: "amount" }, { status: 400 });
  const key = String(fd.get("key") ?? "");
  if (key && !/^[\w-]{8,100}$/.test(key)) return NextResponse.json({ error: "key" }, { status: 400 });
  // monedă străină: curs BCE la data bonului (sau azi), prin EUR → RON; fără curs → suma originală, fără lei
  const currency = normCur(fd.get("currency")) ?? "RON", rDate = String(fd.get("date") ?? ""), day = isDate(rDate) ? rDate : localNow().slice(0, 10);
  const fx = amount != null && amount > 0 && currency !== "RON" ? await toRon(amount, currency, day) : null;
  const fxCols = currency === "RON" ? { currency: null, amountRon: null, fxRate: null, fxDate: null } : { currency, amountRon: fx?.ron ?? null, fxRate: fx?.rate ?? null, fxDate: fx?.fxDate ?? null };
  // demo: nimic în memoria comună a serverului; doar „ultima alimentare” în cookie-ul vizitatorului
  if (tn.demo) {
    const st = clipChars(String(fd.get("station") ?? ""), 80);
    const a = amount != null && amount > 0 ? amount : null;
    const res = NextResponse.json({});
    const { dup, id } = (await addDemoFill(res, { v: vehicleId, t: localNow().slice(0, 16), l: litres, o: odometerKm, a: fxCols.currency ? fx?.ron ?? null : a, c: fxCols.currency ? currency : null, r: fxCols.currency ? a : null, s: st, p: photo instanceof File && photo.size > 0 ? 1 : 0 }));
    const out = NextResponse.json({ ok: true, demo: true, id, overTank: v.tankL > 0 && litres > v.tankL, fx: fxCols.currency ? { ...fxCols, ok: !!fx } : null });
    for (const c of res.cookies.getAll()) out.cookies.set(c);
    if (dup) return (await saveDemoFill(NextResponse.json({ ok: true, demo: true, dup: true, overTank: v.tankL > 0 && litres > v.tankL }), vehicleId, litres, st));
    return (await saveDemoFill(out, vehicleId, litres, st));
  }
  // poza bonului se păstrează pe server (patronul o vede la Bonuri); fără poză salvată → doar numele, ca înainte
  let fileId: string | null = null;
  if (photo instanceof File && photo.size > 0 && tn.firm) { try { fileId = (await saveFile(store(), tn.firm.id, { kind: "receipt", name: photo.name || "bon.jpg", mime: photo.type || "image/jpeg", bytes: Buffer.from(await photo.arrayBuffer()), userId: tn.uid })).id; } catch { return NextResponse.json({ error: "photo not saved" }, { status: 503 }); } }
  const plate = String(fd.get("plate") ?? "").trim().slice(0, 20) || null;
  const row = await r.addDriverFill({ key: key || undefined, userId: tn.uid, plate, vehicleId, time: `${day}T${localNow().slice(11)}`, litres, odometerKm, amount: amount != null && amount > 0 ? amount : null, ...fxCols, station: clipChars(String(fd.get("station") ?? ""), 80), photo: photo instanceof File ? { name: photo.name.slice(0, 80), size: photo.size, fileId } : null, aiRead: fd.get("aiRead") === "true" });
  if (row.duplicate && fileId && row.photo?.fileId !== fileId && tn.firm) await deleteStoredFile(store(), tn.firm.id, fileId);
  if (!row.duplicate) await logDriver(tn, vehicleId, "fill", { note: `${litres} L${row.station ? ` · ${row.station}` : ""}` });
  return NextResponse.json({ ok: true, fill: row, dup: !!row.duplicate, overTank: v.tankL > 0 && litres > v.tankL, fx: fxCols.currency ? { ...fxCols, ok: !!fx } : null });
}
