import { store } from "@/lib/store";
import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { t, type MsgKey } from "@/lib/i18n";
import { Gate } from "@/components/Gate";
import { DriverApp } from "@/components/DriverApp";

export const dynamic = "force-dynamic";
const KEYS: MsgKey[] = ["drv.vehicle", "drv.kmToday", "drv.hoursToday", "drv.start", "drv.stop", "drv.onShift", "drv.offShift", "drv.check", "drv.checkNeeded", "chk.tyres", "chk.fluids", "chk.docs", "chk.damage", "drv.fill", "drv.photo", "drv.photoHint", "drv.reading", "drv.read", "drv.readManual", "drv.litres", "drv.odo", "drv.amount", "drv.station", "drv.send", "drv.sent", "drv.lastFill", "drv.consent", "drv.gpsOff", "drv.invalid"];
export default async function Driver({ searchParams }: { searchParams: { v?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const tn = await tenant(), r = tn.repo;
  const vehicles = await r.vehicles();
  if (!vehicles.length) return <main><EmptyState kind={tn.role === "driver" ? "driver" : "driverOwner"} loc={loc} canSetup={tn.role !== "driver"} /></main>;
  const v = vehicles.find((x) => x.id === searchParams.v) ?? vehicles[0];
  const me = tn.uid && tn.firm ? (await store().users(tn.firm.id)).find((u) => u.id === tn.uid) : null;
  const fd = await r.fleetData();
  const last = [...(await r.driverFills(v.id))].pop();
  const lastCard = fd.fills.filter((f) => f.truckId === v.id).pop();
  const lastFill = last ? `${last.litres} L · ${last.station || "—"}` : lastCard ? `${lastCard.litres} L · ${lastCard.station}` : "—";
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(loc, k)]));
  return (
    <Gate feature="driverApp" prefs={prefs}>
      <main>{!tn.demo && vehicles.length > 1 ? <div className="seg" style={{ marginBottom: 8, flexWrap: "wrap", width: "auto" }}>{vehicles.map((x) => <a key={x.id} href={`/driver?v=${x.id}`} className={x.id === v.id ? "on" : ""}>{x.name}</a>)}</div> : null}<DriverApp vehicleId={v.id} vehicleName={v.name} hello={t(loc, "drv.hi", { name: (v.driver || me?.name || "").split(" ")[0] })} labels={labels} lastFill={lastFill} loc={loc} /></main>
    </Gate>
  );
}
