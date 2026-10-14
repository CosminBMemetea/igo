import { tripStage, STAGE_LABELS, type TripStage } from "@/lib/trip-stage";
import { NewTrip } from "@/components/NewTrip";
import { store } from "@/lib/store";
import { localNow } from "@/lib/validate";
import Link from "next/link";
import { EconKpis } from "@/components/Econ";
import { EL } from "@/lib/econ-i18n";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { monthSummary } from "@/lib/query";
import { fmtMoney, t, tri } from "@/lib/i18n";
import { TripRows } from "../TripRows";

export const dynamic = "force-dynamic";
export default async function Trips({ searchParams }: { searchParams: { new?: string; status?: string; q?: string; truck?: string; month?: string } }) {
  const { loc } = getPrefs();
  const d = await load();
  // „+ Cursă nouă” doar pentru firma reală (demo nu scrie nimic pe server)
  const canNew = !d.demo && !!d.tn.firm && (d.tn.role === "owner" || d.tn.role === "admin");
  const nt = canNew ? <NewTrip loc={loc} today={localNow().slice(0, 10)} autoOpen={searchParams.new === "1"} drivers={(await store().users(d.tn.firm!.id)).filter((u) => u.role === "driver" && !u.disabledAt).map((u) => ({ id: u.id, name: u.name || u.phone || "—", truckId: u.truckId ?? null }))} trucks={d.vehicles.map((v) => ({ id: v.id, plate: v.name }))} /> : null;

  const m = monthSummary(d.views);
  const tr = (s: string) => tri(loc, s), status = ["planned", "loaded", "delivered", "completed", "cancelled", "done"].includes(searchParams.status ?? "") ? searchParams.status : "all";
  const q = (searchParams.q ?? "").trim().toLocaleLowerCase();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? "") ? searchParams.month! : "";
  const allRows = [...d.views, ...d.cancelledViews];
  const rows = allRows.filter((v) => (status === "all" || tripStage(v) === (status === "done" ? "completed" : status)) && (!searchParams.truck || v.vehicleId === searchParams.truck) && (!month || v.date.startsWith(month)) && (!q || `${v.title} ${d.clients.find((c) => c.id === v.clientId)?.name ?? ""} ${v.driverName ?? v.vehicle.driver} ${v.vehicle.name}`.toLocaleLowerCase().includes(q))).sort((a, b) => status === "planned" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  return (
    <main>
      <div className="eyebrow fade">{t(loc, "nav.trips")}</div>
      <div className="thead-row"><h1 className="h1 fade">{t(loc, "trips.title")}</h1>{nt}</div>
      <p className="sub fade d1" dangerouslySetInnerHTML={{ __html: t(loc, "trips.sub", { n: m.n, total: fmtMoney(loc, m.profit) }) }} />
      <EconKpis vehicles={d.allVehicles} views={d.views} loc={loc} />
      <form className="sheet" method="get" style={{ marginTop: 24 }}>
        <div className="nt2"><label className="lf"><span>{tr("Caută rută, șofer sau camion|Search route, driver or truck|Szukaj trasy, kierowcy lub pojazdu")}</span><input name="q" defaultValue={searchParams.q} /></label>
        <label className="lf"><span>{tr("Stare|Status|Status")}</span><select name="status" defaultValue={status === "done" ? "completed" : status}><option value="all">{tr("Toate|All|Wszystkie")} ({allRows.length})</option>{(Object.keys(STAGE_LABELS) as TripStage[]).map((stage) => <option key={stage} value={stage}>{tr(STAGE_LABELS[stage])} ({allRows.filter((v) => tripStage(v) === stage).length})</option>)}</select></label>
        <label className="lf"><span>{tr("Camion|Truck|Pojazd")}</span><select name="truck" defaultValue={searchParams.truck ?? ""}><option value="">{tr("Toate camioanele|All trucks|Wszystkie pojazdy")}</option>{d.allVehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label className="lf"><span>{tr("Luna (opțional)|Month (optional)|Miesiąc (opcjonalnie)")}</span><input type="month" name="month" defaultValue={month} /></label></div>
        <div className="invrow"><button className="btn sec">{tr("Aplică filtrele|Apply filters|Zastosuj filtry")}</button><Link className="link" href="/trips">{tr("Resetează|Reset|Resetuj")}</Link></div>
      </form>
      <section className="section" style={{ marginTop: 24 }}><p className="hint">{rows.length} {tr("curse afișate · indicatorii de sus sunt pentru luna curentă|trips shown · indicators above cover the current month|kursów · wskaźniki powyżej dotyczą bieżącego miesiąca")}</p>{rows.length ? <TripRows rows={rows} loc={loc} /> : <p className="sub">{tr("Nicio cursă în această listă. Creează o cursă sau modifică filtrele.|No trips in this list. Create a trip or change the filters.|Brak kursów. Utwórz kurs lub zmień filtry.")}</p>}</section>
      {d.allVehicles.some((v) => v.archived) ? (
        <section className="section"><div className="head"><h2>{EL[loc].archivedList}</h2></div>
          <div className="list">{d.allVehicles.filter((v) => v.archived).map((v) => <Link key={v.id} className="it" href={`/vehicles/${v.id}`}><div><div className="t">{v.name}</div><div className="m">{v.model} · {d.archivedViews.filter((x) => x.vehicleId === v.id).length} {EL[loc].trips}</div></div><span className="lbadge empty">{EL[loc].archived}</span></Link>)}</div>
        </section>
      ) : null}
    </main>
  );
}
