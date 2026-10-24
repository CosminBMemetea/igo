import { DriverShiftDock } from "@/components/DriverShiftDock";
import { DriverTrips } from "@/components/DriverTrips";
import { DriverOutbox } from "@/components/DriverOutbox";
import { Gate } from "@/components/Gate";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { tri } from "@/lib/i18n";
import { driverView } from "@/lib/driver-view";
export const dynamic = "force-dynamic";

/** Curse: Acum / Următoarele / Terminate (30 zile), fiecare cu ce mai lipsește. */
export default async function DriverTripsPage(props: { searchParams: Promise<{ v?: string }> }) {
  const sp = await props.searchParams, prefs = await getPrefs(), { loc } = prefs;
  const tn = await tenant();
  const dv = await driverView(tn, tn.role === "driver" ? undefined : sp.v);
  const queueScope = !tn.demo && tn.role === "driver" && tn.firm && tn.uid ? `${tn.firm.id}:${tn.uid}` : undefined;
  return <Gate feature="driverApp" prefs={prefs}><main className="driver-main">
    {queueScope ? <DriverOutbox scope={queueScope} loc={loc} /> : null}
    <h1 className="dpage-h fade">{tri(loc, "Cursele mele|My trips|Moje kursy")}</h1>
    <DriverTrips queueScope={queueScope} trips={dv.trips} docs={dv.docs} today={dv.today} truckId={dv.vehicle?.id ?? dv.me?.truckId} trucks={dv.allVehicles.map(x => ({ id: x.id, name: x.name }))} loc={loc} embedded={tn.demo || tn.role !== "driver"} demo={tn.demo} />
  <DriverShiftDock /></main></Gate>;
}
