import { leiOf } from "./lei";
// Querra Fleet: importul CSV în modul demo — totul într-un MemStore nou, per cerere. Nimic nu ajunge în baza de date.
import { MemStore } from "../store/mem";
import { FirmRepository, truckBaseline } from "../firm-repo";
import { fillToFill } from "./rules";
import { alertTitle, alertWhy } from "../alert-text";
import { fmtMoney, fmtNum, plural, t, type Locale, type MsgKey } from "../i18n";
import { headers } from "next/headers";
import { TRUCKS } from "../fleet/data";

export const DEMO_TRUCKS = TRUCKS.map(({ plate, tankL, normalL100 }) => ({ plate, tankL, normalL100 }));
/** Demo = sesiune „Intră ca demo” sau admin fără firmă aleasă. */
export const isDemoImporter = () => { const r = headers().get("x-igo-role"); return r === "user" || r === "admin"; };
export async function demoSandbox() {
  const s = new MemStore();
  const f = await s.createFirm({ name: "Firmă demo", cui: null });
  for (const x of DEMO_TRUCKS) await s.addTruck(f.id, { ...x, vin: null, model: null });
  return { s, f };
}
export async function demoResult(s: MemStore, firm: Awaited<ReturnType<MemStore["createFirm"]>>, loc: Locale) {
  const [trucks, tx] = await Promise.all([s.trucks(firm.id), s.fuel(firm.id, { limit: 50000 })]);
  const since = firm.createdAt.slice(0, 16);
  const report = trucks.map((tr) => {
    const mine = tx.filter((x) => x.truckId === tr.id);
    const b = truckBaseline(tr, tx, since), recent = fillToFill(mine.map((x) => ({ ...x })));
    // EUR (ex. DKV în străinătate) convertit în lei, nu adunat ca lei
    const lei = mine.reduce((a, x) => a + (leiOf(x) ?? 0), 0);
    return { plate: tr.plate, n: mine.length, meta: t(loc, "imp.truckMeta", { fills: plural(loc, mine.length, "u.fill"), litres: fmtNum(loc, mine.reduce((a, x) => a + x.litres, 0)), lei: fmtMoney(loc, lei) }), base: `${t(loc, `imp.base.${b.kind}` as MsgKey, { l100: fmtNum(loc, b.l100, 1), km: fmtNum(loc, b.km) })}${recent.l100 ? ` · ${t(loc, "imp.now", { l100: fmtNum(loc, recent.l100, 1) })}` : ""}` };
  }).filter((x) => x.n);
  const alerts = (await new FirmRepository(s, firm).alerts()).map((a) => ({ id: a.id, severity: a.severity, theft: a.theft, title: `${alertTitle(loc, a)} · ${trucks.find((x) => x.id === a.vehicleId)?.plate ?? ""}`, why: alertWhy(loc, a), nogps: !!a.params?.nogps }));
  return { report, alerts };
}
