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
export default async function Trips() {
  const { loc } = getPrefs();
  const d = await load();
  if (!d.demo && !d.trips.length) return <main><EmptyState kind="trips" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const m = monthSummary(d.views);
  return (
    <main>
      <div className="eyebrow fade">{t(loc, "nav.trips")}</div>
      <h1 className="h1 fade">{t(loc, "trips.title")}</h1>
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
