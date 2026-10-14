import { NewTrip } from "@/components/NewTrip";
import { store } from "@/lib/store";
import { localNow } from "@/lib/validate";
import Link from "next/link";
import { EconKpis } from "@/components/Econ";
import { EL } from "@/lib/econ-i18n";
import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { monthSummary } from "@/lib/query";
import { fmtMoney, t } from "@/lib/i18n";
import { TripRows } from "../TripRows";

export const dynamic = "force-dynamic";
export default async function Trips({ searchParams }: { searchParams: { new?: string } }) {
  const { loc } = getPrefs();
  const d = await load();
  // „+ Cursă nouă” doar pentru firma reală (demo nu scrie nimic pe server)
  const canNew = !d.demo && !!d.tn.firm && (d.tn.role === "owner" || d.tn.role === "admin");
  const nt = canNew ? <NewTrip loc={loc} today={localNow().slice(0, 10)} autoOpen={searchParams.new === "1"} drivers={(await store().users(d.tn.firm!.id)).filter((u) => u.role === "driver" && !u.disabledAt).map((u) => ({ id: u.id, name: u.name || u.phone || "—", truckId: u.truckId ?? null }))} trucks={d.vehicles.map((v) => ({ id: v.id, plate: v.name }))} /> : null;
  if (!d.demo && !d.trips.length) return <main>{nt ? <div style={{ marginBottom: 16 }}>{nt}</div> : null}<EmptyState kind="trips" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const m = monthSummary(d.views);
  return (
    <main>
      <div className="eyebrow fade">{t(loc, "nav.trips")}</div>
      <div className="thead-row"><h1 className="h1 fade">{t(loc, "trips.title")}</h1>{nt}</div>
      <p className="sub fade d1" dangerouslySetInnerHTML={{ __html: t(loc, "trips.sub", { n: m.n, total: fmtMoney(loc, m.profit) }) }} />
      <EconKpis vehicles={d.vehicles} views={d.views} loc={loc} />
      <section className="section" style={{ marginTop: 32 }}><TripRows rows={d.views} loc={loc} /></section>
      {d.allVehicles.some((v) => v.archived) ? (
        <section className="section"><div className="head"><h2>{EL[loc].archivedList}</h2></div>
          <div className="list">{d.allVehicles.filter((v) => v.archived).map((v) => <Link key={v.id} className="it" href={`/vehicles/${v.id}`}><div><div className="t">{v.name}</div><div className="m">{v.model} · {d.archivedViews.filter((x) => x.vehicleId === v.id).length} {EL[loc].trips}</div></div><span className="lbadge empty">{EL[loc].archived}</span></Link>)}</div>
        </section>
      ) : null}
    </main>
  );
}
