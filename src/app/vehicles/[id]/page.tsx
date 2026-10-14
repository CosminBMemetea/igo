import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { vehicleSummary } from "@/lib/query";
import { fmtMoney, fmtNum, t, tri } from "@/lib/i18n";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import { mapLabels } from "@/lib/labels";
import { CountUp } from "@/components/CountUp";
import FleetMap from "@/components/FleetMap";
import { Gate } from "@/components/Gate";
import { VehicleArt } from "@/components/VehicleArt";
import { Mini } from "@/components/Feed";
import { miniRoute } from "@/lib/feed";
import { truckById } from "@/lib/fleet/data";
import { TripRows } from "../../TripRows";
import { EL, ef } from "@/lib/econ-i18n";
import { FIXED_KEYS, VAR_KEYS, fixedMonthly, hasCosts, profileOf, nextCostMonth, varPerKm, type CostKey, type FixedKey } from "@/lib/costs";
import { econOf } from "@/lib/econ";
import { FleetCompare } from "@/components/Econ";
import { fmtPct } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export default async function VehiclePage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; saved?: string; archived?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  const v = d.allVehicles.find((x) => x.id === params.id);
  if (!v) notFound();
  const s = vehicleSummary(v, v.archived ? d.archivedViews : d.views);
  const L = EL[loc], econ = hasCosts(v), tab = econ && searchParams.tab === "costs" ? "costs" : "overview";
  const canEdit = d.tn.role === "owner" || d.tn.role === "admin" || (d.demo && d.tn.role !== "driver");
  const ve = econ ? econOf(v, v.archived ? d.archivedViews : d.views) : null;
  const agri = v.kind === "agri";
  const unit = agri ? t(loc, "veh.lha") : t(loc, "veh.l100");
  const myParcels = d.parcels.filter((p) => s.trips.some((x) => x.parcelId === p.id));
  const liveV = (await d.live()).find((x) => x.id === v.id);
  const truck = truckById(v.id), route = truck && liveV ? miniRoute(truck, liveV.today) : null;
  const body = (
    <main>
      <section className="vehicle">
        <div className="fade">
          <div className="eyebrow">{t(loc, `kind.${v.kind}`)} · {v.model}</div>
          <div className="vhead"><h1 className="h1">{v.name}</h1>{v.kind === "truck" ? <Link className="rp-mini" href={`/replay?v=${v.id}`} aria-label={t(loc, "rp.cta")}><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>{t(loc, "rp.cta")}</Link> : null}</div>
          <p className="sub">{v.driver}{agri ? ` · ${t(loc, "veh.season")}` : ""}</p>
          {v.archived ? <div className="archnote"><span className="lbadge empty">{L.archived}</span> {L.archivedB} <Link href={`/vehicles/${v.id}?tab=costs`}>{L.restore} →</Link></div> : null}
          {econ ? <nav className="vtabs" aria-label={v.name}><Link href={`/vehicles/${v.id}`} className={tab === "overview" ? "on" : ""} aria-current={tab === "overview" ? "page" : undefined}>{L.tabOverview}</Link><Link href={`/vehicles/${v.id}?tab=costs`} className={tab === "costs" ? "on" : ""} aria-current={tab === "costs" ? "page" : undefined}>{L.tabCosts}</Link></nav> : null}
          <div style={{ marginTop: 44 }}>
            <div className="eyebrow">{t(loc, "home.savings")}</div>
            <div className="big"><CountUp value={s.savings.pct * 100} d={1} loc={loc} /><small>%</small></div>
            <p className="sub">{fmtNum(loc, s.actualRate, 1)} {unit} · {t(loc, "veh.savings", { base: fmtNum(loc, v.baselineRate, 1), unit })}</p>
          </div>
        </div>
        {route ? <div className="vroute fade d1"><Mini m={route} live={liveV?.status === "moving"} draw={1.8} /><span>{truck!.routeName}</span></div> : <VehicleArt kind={v.kind} />}
      </section>
      <section className="cards section">
        {agri ? (
          <>
            <div className="card fade"><div className="k">{t(loc, "veh.lph")}</div><div className="n">{fmtNum(loc, s.hours ? s.savings.actualLitres / s.hours : 0, 1)}</div><div className="d">{t(loc, "veh.hours")}: {fmtNum(loc, v.engineHours ?? 0)} h · {fmtNum(loc, s.hours, 1)} h {t(loc, "veh.season").toLowerCase()}</div></div>
            <div className="card fade d1"><div className="k">{t(loc, "veh.ha")}</div><div className="n">{fmtNum(loc, s.ha)}</div><div className="d">{fmtNum(loc, s.actualRate, 1)} {unit}</div></div>
          </>
        ) : (
          <>
            <div className="card fade"><div className="k">{t(loc, "veh.l100")}</div><div className="n">{fmtNum(loc, s.actualRate, 1)}</div><div className="d">{t(loc, "veh.savings", { base: fmtNum(loc, v.baselineRate, 1), unit })}</div></div>
            <div className="card fade d1"><div className="k">{t(loc, "veh.km")}</div><div className="n">{fmtNum(loc, s.km)}</div><div className="d">{s.n} {t(loc, "veh.trips").toLowerCase()}</div></div>
          </>
        )}
        <div className="card fade d2"><div className="k">{t(loc, "veh.saved")}</div><div className="n pos">{fmtMoney(loc, s.savings.savedLei)}</div><div className="d">({fmtNum(loc, v.baselineRate, 1)} − {fmtNum(loc, s.actualRate, 1)}) × {fmtNum(loc, s.units)} {agri ? "ha" : "km"}{v.per100 ? " / 100" : ""} × {fmtNum(loc, 7.3, 2)}</div></div>
      </section>
      {liveV ? <Link href={`/live?v=${v.id}`} className="mapstrip" style={{ display: "block" }}>
        <FleetMap mode="strip" vehicles={[liveV]} zones={d.zones} parcels={agri ? myParcels : []} theme={prefs.theme} loc={loc} labels={mapLabels(loc)} now={DEMO_NOW_MIN} />
      </Link> : null}
      <section className="section">
        <div className="head"><h2>{t(loc, agri ? "veh.jobs" : "veh.trips")}</h2><span className="link">{t(loc, "veh.profit")}: {fmtMoney(loc, s.profit)}</span></div>
        {agri ? <p className="sub" style={{ marginBottom: 12 }}>{t(loc, "veh.parcels")}: {myParcels.map((p) => `${p.name} (${p.ha} ha, ${t(loc, `crop.${p.crop}`)})`).join(" · ")}</p> : null}
        <TripRows rows={s.trips} loc={loc} />
      </section>
    </main>
  );
  if (tab === "costs" && ve) {
    const effectiveMonth = nextCostMonth();
    const pr = profileOf(v, d.demo ? undefined : effectiveMonth), fm = fixedMonthly(pr), fpk = (v.archived ? d.archivedViews : d.views).find((x) => x.vehicleId === v.id && x.e)?.e?.fixedPerKm ?? 0, kmM = fpk ? fm / fpk : 0;
    const fld = (k: CostKey, step: string) => <label key={k}><span>{L[k]}</span><span className="einp"><input className="input" name={k} inputMode="decimal" step={step} defaultValue={String(pr[k])} disabled={!canEdit} /><em>{FIXED_KEYS.includes(k as FixedKey) ? `${t(loc, "cur")} ${L.perMonth}` : k === "capacityT" ? "t" : k === "loadWear" ? "" : `${t(loc, "cur")} ${L.perKm}`}</em></span></label>;
    return (
      <main>
        <section className="vehicle"><div className="fade">
          <div className="eyebrow">{t(loc, `kind.${v.kind}`)} · {v.model}</div>
          <div className="vhead"><h1 className="h1">{v.name}</h1></div>
          <p className="sub">{v.driver}</p>
          {v.archived ? <div className="archnote"><span className="lbadge empty">{L.archived}</span> {L.archivedB}</div> : null}
          <nav className="vtabs"><Link href={`/vehicles/${v.id}`}>{L.tabOverview}</Link><Link href={`/vehicles/${v.id}?tab=costs`} className="on" aria-current="page">{L.tabCosts}</Link></nav>
        </div></section>
        {searchParams.saved ? <div className="esaved fade" role="status">✓ {d.demo ? L.saved : tri(loc, "Costurile au fost programate pentru luna următoare.|Costs scheduled for next month.|Koszty zaplanowano na następny miesiąc.")}</div> : null}
        <section className="cards section ecards">
          <div className="card fade"><div className="k">{L.costKm}</div><div className="n">{fmtMoney(loc, ve.cpk, 2)}</div><div className="d">{fmtMoney(loc, fm / Math.max(1, kmM), 2)} {L.fixedPerKm} · {fmtMoney(loc, varPerKm(pr), 2)} {L.varTotal}</div></div>
          <div className="card fade d1"><div className="k">{L.realProfit}</div><div className={`n ${ve.profit < 0 ? "neg" : "pos"}`}>{fmtMoney(loc, ve.profit)}</div><div className="d">{ve.n} {L.trips} · {L.margin} {fmtPct(loc, ve.margin, 1)}</div></div>
          <div className="card fade d2"><div className="k">{L.load}</div><div className="n">{ve.loadPct === null ? "—" : fmtPct(loc, ve.loadPct, 0)}</div><div className="d">{L.emptyKm}: {fmtNum(loc, ve.emptyKm)} km · {fmtPct(loc, ve.km ? ve.emptyKm / ve.km : 0, 0)}</div></div>
        </section>
        {!d.demo ? <section className="sheet"><h2>{tri(loc, "Costuri în vigoare din|Costs effective from|Koszty obowiązujące od")} {effectiveMonth}</h2><p>{tri(loc, "Salvarea înlocuiește doar valorile programate pentru această lună viitoare. Lunile anterioare rămân neschimbate.|Saving replaces only the values scheduled for this future month. Earlier months remain unchanged.|Zapis zastępuje tylko wartości zaplanowane na ten przyszły miesiąc. Wcześniejsze miesiące pozostają bez zmian.")}</p>{(v.costHistory ?? []).length ? <ul>{[...(v.costHistory ?? [])].sort((a, b) => b.month.localeCompare(a.month)).map((x) => <li key={x.month}>{x.month} · {L.fixedTotal}: {fmtMoney(loc, fixedMonthly(profileOf(v, x.month)))} · {L.varTotal}: {fmtMoney(loc, varPerKm(profileOf(v, x.month)), 2)}</li>)}</ul> : null}</section> : null}
        <form className="section ecost" action="/api/vehicles/econ" method="post">
          <input type="hidden" name="action" value="costs" /><input type="hidden" name="vid" value={v.id} />
          <div className="ecol"><div className="head"><h2>{L.fixedT}</h2><span className="link">{L.fixedTotal}: {fmtMoney(loc, fm)} {L.perMonth}</span></div><div className="egrid">{FIXED_KEYS.map((k) => fld(k, "50"))}</div><p className="hint">{ef(L.kmMonth, { n: fmtNum(loc, Math.round(kmM)) })} → {fmtMoney(loc, fm / Math.max(1, kmM), 2)} {L.fixedPerKm}</p></div>
          <div className="ecol"><div className="head"><h2>{L.varT}</h2><span className="link">{fmtMoney(loc, varPerKm(pr), 2)} {L.perKm}</span></div><div className="egrid">{VAR_KEYS.map((k) => fld(k, "0.01"))}{fld("loadWear", "0.001")}{fld("capacityT", "0.5")}</div><p className="hint">{L.fuel} · {L.tolls} · {L.driver}: {L.perTrip}</p></div>
          {canEdit ? <div className="eact"><button className="btn pri">{L.save}</button>{d.demo ? <span className="hint">{L.demoNote}</span> : null}</div> : <p className="hint">{L.ownerOnly}</p>}
        </form>
        <section className="section"><div className="head"><h2>{L.fleetCmp}</h2></div><FleetCompare vehicles={d.vehicles} views={d.views} loc={loc} current={v.id} /></section>
        {canEdit ? (
          <section className="section">
            {v.archived ? (
              <form action="/api/vehicles/econ" method="post"><input type="hidden" name="action" value="restore" /><input type="hidden" name="vid" value={v.id} /><button className="btn sec">{L.restore}</button></form>
            ) : (
              <details className="earch"><summary className="btn sec danger">{L.archT}</summary><div className="earch-b"><p>{L.archB}</p><form action="/api/vehicles/econ" method="post"><input type="hidden" name="action" value="archive" /><input type="hidden" name="vid" value={v.id} /><button className="btn pri danger">{L.archGo}</button></form>{d.demo ? <p className="hint">{L.demoNote}</p> : null}</div></details>
            )}
          </section>
        ) : null}
      </main>
    );
  }
  return agri ? <Gate feature="agri" prefs={prefs}>{body}</Gate> : body;
}
