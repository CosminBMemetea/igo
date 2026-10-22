import { SearchField } from "@/components/SearchField";
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
export default async function Trips(
  props: { searchParams: Promise<{ deleted?: string; new?: string; status?: string; q?: string; truck?: string; month?: string }> }
) {
  const searchParams = await props.searchParams;
  const { loc } = (await getPrefs());
  const d = await load();
  // „+ Cursă nouă” doar pentru firma reală (demo nu scrie nimic pe server)
  const canNew = !d.demo && !!d.tn.firm && (d.tn.role === "owner" || d.tn.role === "admin");
  const nt = canNew ? <NewTrip loc={loc} today={localNow().slice(0, 10)} autoOpen={searchParams.new === "1"} drivers={(await store().users(d.tn.firm!.id)).filter((u) => u.role === "driver" && !u.disabledAt).map((u) => ({ id: u.id, name: u.name || u.phone || "—", truckId: u.truckId ?? null }))} trucks={d.vehicles.map((v) => ({ id: v.id, plate: v.name }))} /> : null;

  const m = monthSummary(d.views);
  const tr = (s: string) => tri(loc, s), status = ["planned", "loaded", "delivered", "completed", "cancelled", "done"].includes(searchParams.status ?? "") ? searchParams.status : "all";
  const q = (searchParams.q ?? "").trim().toLocaleLowerCase();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? "") ? searchParams.month! : "";
  const allRows = [...d.views, ...d.cancelledViews];
  const months = [...new Set([...allRows.map(v => v.date.slice(0, 7)), month].filter(value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)))].sort().reverse();
  const monthLabel = (value: string) => new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
  const filtered = !!q || status !== "all" || !!searchParams.truck || !!month;
  const rows = allRows.filter((v) => (status === "all" || tripStage(v) === (status === "done" ? "completed" : status)) && (!searchParams.truck || v.vehicleId === searchParams.truck) && (!month || v.date.startsWith(month)) && (!q || `${v.title} ${d.clients.find((c) => c.id === v.clientId)?.name ?? ""} ${v.driverName ?? v.vehicle.driver} ${v.vehicle.name}`.toLocaleLowerCase().includes(q))).sort((a, b) => status === "planned" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  return (
    <main>{searchParams.deleted ? <p className="msg ok" role="status">{tri(loc, "Cursa a fost ștearsă definitiv.|The trip was deleted permanently.|Kurs został trwale usunięty.")}</p> : null}
      <div className="eyebrow fade">{t(loc, "nav.trips")}</div>
      <div className="thead-row"><h1 className="h1 fade">{t(loc, "trips.title")}</h1>{nt}</div>
      <p className="sub fade d1" dangerouslySetInnerHTML={{ __html: t(loc, "trips.sub", { n: m.n, total: fmtMoney(loc, m.profit) }) }} />
      <EconKpis vehicles={d.allVehicles} views={d.views} loc={loc} />
      <form className="sheet trip-filters" method="get" action="/trips" role="search" aria-label={tr("Caută curse|Search trips|Szukaj kursów")}>
        <div className="trip-filter-heading"><h2>{tr("Găsește o cursă|Find a trip|Znajdź kurs")}</h2><span>{tr("Caută în lista de curse|Search your trip list|Przeszukaj listę kursów")}</span></div>
        <div className="trip-filter-grid">
          <div className="trip-filter-query"><SearchField id="trip-query" label={tr("Caută|Search|Szukaj")} value={searchParams.q} placeholder={tr("Rută, client, șofer sau camion|Route, client, driver or truck|Trasa, klient, kierowca lub pojazd")} button={tr("Caută|Search|Szukaj")} /></div>
          <label className="lf"><span>{tr("Stare|Status|Status")}</span><select name="status" defaultValue={status === "done" ? "completed" : status}><option value="all">{tr("Toate stările|All statuses|Wszystkie statusy")} ({allRows.length})</option>{(Object.keys(STAGE_LABELS) as TripStage[]).map((stage) => <option key={stage} value={stage}>{tr(STAGE_LABELS[stage])} ({allRows.filter((v) => tripStage(v) === stage).length})</option>)}</select></label>
          <label className="lf"><span>{tr("Camion|Truck|Pojazd")}</span><select name="truck" defaultValue={searchParams.truck ?? ""}><option value="">{tr("Toate camioanele|All trucks|Wszystkie pojazdy")}</option>{d.allVehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label className="lf"><span>{tr("Luna|Month|Miesiąc")}</span><select name="month" defaultValue={month}><option value="">{tr("Toate lunile|All months|Wszystkie miesiące")}</option>{months.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></label>
        </div>
        <div className="trip-filter-footer"><p className="hint">{filtered ? tr("Filtre active · rezultatele sunt mai jos.|Filters active · results are below.|Aktywne filtry · wyniki poniżej.") : tr("Combină filtrele pentru a restrânge lista.|Combine filters to narrow the list.|Połącz filtry, aby zawęzić listę.")}</p><div className="trip-filter-actions">{filtered && <Link className="btn sec" href="/trips">{tr("Șterge filtrele|Clear filters|Wyczyść filtry")}</Link>}</div></div>
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
