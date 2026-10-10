import { getPrefs } from "@/lib/prefs";
import { repo } from "@/lib/repo";
import { t, type MsgKey } from "@/lib/i18n";
import { Gate } from "@/components/Gate";
import { DriverApp } from "@/components/DriverApp";

export const dynamic = "force-dynamic";
const KEYS: MsgKey[] = ["drv.vehicle", "drv.kmToday", "drv.hoursToday", "drv.start", "drv.stop", "drv.onShift", "drv.offShift", "drv.check", "drv.checkNeeded", "chk.tyres", "chk.fluids", "chk.docs", "chk.damage", "drv.fill", "drv.photo", "drv.photoHint", "drv.reading", "drv.read", "drv.readManual", "drv.litres", "drv.odo", "drv.amount", "drv.station", "drv.send", "drv.sent", "drv.lastFill", "drv.consent", "drv.gpsOff", "drv.invalid"];
export default async function Driver({ searchParams }: { searchParams: { v?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const r = repo();
  const vehicles = await r.vehicles();
  const v = vehicles.find((x) => x.id === searchParams.v) ?? vehicles[0];
  const fd = await r.fleetData();
  const last = [...(await r.driverFills(v.id))].pop();
  const lastCard = fd.fills.filter((f) => f.truckId === v.id).pop();
  const lastFill = last ? `${last.litres} L · ${last.station || "—"}` : lastCard ? `${lastCard.litres} L · ${lastCard.station}` : "—";
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(loc, k)]));
  return (
    <Gate feature="driverApp" prefs={prefs}>
      <main><DriverApp vehicleId={v.id} vehicleName={v.name} hello={t(loc, "drv.hi", { name: v.driver.split(" ")[0] })} labels={labels} lastFill={lastFill} loc={loc} /></main>
    </Gate>
  );
}
