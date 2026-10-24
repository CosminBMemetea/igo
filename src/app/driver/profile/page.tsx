import { DriverShiftDock } from "@/components/DriverShiftDock";
import { DriverProgress } from "@/components/DriverProgress";
import { DemoSwitcher } from "@/components/DemoSwitcher";
import { Gate } from "@/components/Gate";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { tri, t } from "@/lib/i18n";
import { driverView } from "@/lib/driver-view";
import { driverProgress } from "@/lib/driver-progress";
export const dynamic = "force-dynamic";

/** Profil: cine sunt, ce camion am, progresul meu, ieșire. */
export default async function DriverProfilePage(props: { searchParams: Promise<{ v?: string }> }) {
  const sp = await props.searchParams, prefs = await getPrefs(), { loc } = prefs;
  const tn = await tenant();
  const dv = await driverView(tn, tn.role === "driver" ? undefined : sp.v);
  const progress = !tn.demo && tn.firm && tn.uid && tn.role === "driver" ? driverProgress(await store().users(tn.firm.id), await store().trips(tn.firm.id), tn.uid, dv.today) : null;
  const name = tn.demo ? dv.driverName : dv.me?.name || dv.driverName;
  return <Gate feature="driverApp" prefs={prefs}><main className="driver-main">
    <h1 className="dpage-h fade">{tri(loc, "Profil|Profile|Profil")}</h1>
    <section className="sheet dprof fade">
      <div className="dprof-av" aria-hidden="true">{(name || "?").trim().charAt(0).toUpperCase()}</div>
      <div><b>{name || "—"}</b>{!tn.demo && dv.me?.phone ? <small>{dv.me.phone}</small> : null}</div>
    </section>
    <div className="list fade d1">
      <div className="it" style={{ cursor: "default" }}><div><div className="m">{tri(loc, "Camionul meu|My truck|Mój pojazd")}</div><div className="t">{dv.vehicle?.name ?? tri(loc, "Nealocat|Not assigned|Nieprzypisany")}</div></div></div>
      <div className="it" style={{ cursor: "default" }}><div><div className="m">{tri(loc, "Limba|Language|Język")}</div><div className="t">{tri(loc, "Schimbi limba din meniul de sus.|Change language from the top menu.|Język zmienisz w górnym menu.")}</div></div></div>
    </div>
    {progress ? <DriverProgress progress={progress} loc={loc} /> : null}
    <p className="sub drv-consent">{t(loc, "drv.consent")}</p>
    {tn.demo && tn.role === "driver" ? <DemoSwitcher loc={loc} driver /> : null}
    {!tn.demo ? <form action="/api/auth/logout" method="post" className="dprof-out"><button className="btn sec start" type="submit">{tri(loc, "Ieși din cont|Sign out|Wyloguj")}</button></form> : null}
  <DriverShiftDock /></main></Gate>;
}
