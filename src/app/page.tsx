import { ReplayTeaser } from "@/components/ReplayTeaser";
import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { monthSummary } from "@/lib/query";
import { enoughData } from "@/lib/calc";
import { fmtMoney, fmtNum, t, plural } from "@/lib/i18n";
import { FUEL_PRICE } from "@/lib/fleet/seed";
import { rankings } from "@/lib/ranking";
import { DriverCard } from "@/components/Ranking";
import { mapLabels } from "@/lib/labels";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import { CountUp } from "@/components/CountUp";
import { AskBox } from "@/components/AskBox";
import FleetMap from "@/components/FleetMap";
import { Gate } from "@/components/Gate";
import { TripRows } from "./TripRows";
import { EmptyState } from "@/components/EmptyState";
import { setupState } from "@/lib/setup";
import { store } from "@/lib/store";
import { AlertList } from "./AlertList";
import { docStatus, STATUS_CLASS } from "@/lib/docs";
import { todayFor } from "@/lib/today";
import { fmtDate, type MsgKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export default async function Home() {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  const canSetup = d.tn.role === "owner" || d.tn.role === "admin";
  const st = !d.demo && d.tn.firm && canSetup ? await setupState(store(), d.tn.firm.id) : null;
  const welcome = st && !st.complete ? (
    <Link href={`/setup${st.next ? `?step=${st.next}` : ""}`} className="welcome fade">
      <div><div className="eyebrow">{t(loc, "home.welcome", { firm: d.tn.firm!.name })}</div><div style={{ fontSize: 22, fontWeight: 300, marginTop: 8 }}>{t(loc, "home.setupLeft", { n: 5 - st.n })}</div><div className="pbar"><i style={{ width: `${(st.n / 5) * 100}%` }} /></div></div>
      <span className="btn pri">{t(loc, "home.setupGo")}</span>
    </Link>
  ) : null;
  if (!d.demo && !d.trips.length) return <main>{welcome}<EmptyState kind="home" loc={loc} canSetup={canSetup} /></main>;
  const m = monthSummary(d.views);
  const live = d.live();
  const km = d.views.filter((v) => !v.active).reduce((s, v) => s + v.km, 0), hours = d.views.filter((v) => !v.active).reduce((s, v) => s + v.hours, 0);
  const recent = [...d.views.filter((v) => v.active).slice(0, 2), ...d.views.filter((v) => !v.active).slice(0, 4)];
  const today = todayFor(d.demo);
  const docs = (await d.tn.repo.docs()).filter((x) => x.expires && x.scope !== "trip").map((x) => ({ ...x, st: docStatus(x.expires!, today) })).filter((x) => x.st.status !== "valid").sort((a, b) => a.st.days - b.st.days).slice(0, 4);
  const docName = (x: (typeof docs)[number]) => (x.scope === "vehicle" ? d.vehicles.find((v) => v.id === x.ownerId)?.name ?? x.ownerId : x.ownerId);
  // „4 / 8” era: vehicule în mișcare / total. Acum: chipuri cu etichetă.
  const moving = live.filter((x) => x.status === "moving" || x.status === "working").length;
  const priv = live.filter((x) => x.status === "private").length, stopped = live.length - moving - priv;
  const kmToday = Math.round(live.filter((x) => x.todayUnit === "km").reduce((a, x) => a + x.today, 0));
  const saveToday = Math.round(live.filter((x) => x.todayUnit === "km").reduce((a, x) => { const v = d.vehicles.find((y) => y.id === x.id); return a + (v ? Math.max(0, ((v.baselineRate - x.rate) * x.today) / 100) * FUEL_PRICE : 0); }, 0));
  const rk = rankings(d.vehicles, d.views, d.alerts, today, d.demo), rkHelp = [...rk.drivers].reverse().find((x) => x.worst && x.score < 75) ?? null;
  // economie pe lună: aceeași perioadă ca pe /savings (demo: 15 zile de istoric)
  const savDays = d.demo ? 15 : Math.max(1, Math.round((Date.now() - Date.parse(d.tn.firm?.createdAt ?? new Date().toISOString())) / 86400000));
  const perMonth = Math.round(m.savings.savedLei / (savDays / 30));
  // alerta de furt cea mai gravă (card plătit departe de camion) — prima pe ecran, deasupra economiei
  const theft = d.alerts.find((a) => a.rule === "card-fara-camion") ?? d.alerts.find((a) => a.theft) ?? null;
  const theftV = theft ? d.vehicles.find((v) => v.id === theft.vehicleId) : null;
  const alertsToday = d.alerts.filter((a) => a.time.slice(0, 10) === today).length;
  return (
    <main>
      {welcome}
      {theft && theft.rule === "card-fara-camion" ? (
        <Link href={`/alerts#${theft.id}`} className="theft fade">
          <span className="tic" aria-hidden="true">!</span>
          <span className="tx"><span className="ey">{t(loc, "home.theftEy")}</span><b>{t(loc, "home.theft", { litres: fmtNum(loc, Number(theft.params.litres)), station: String(theft.params.station), dist: fmtNum(loc, Number(theft.params.dist)) })}</b><small>{theftV?.name} · {fmtDate(loc, String(theft.params.time ?? theft.time))} · {fmtMoney(loc, Number(theft.params.litres) * FUEL_PRICE)} {t(loc, "home.theftRisk")}</small></span>
          <span className="go">{t(loc, "home.theftGo")} →</span>
        </Link>
      ) : null}
      <section className="hero">
        <div className="fade">
          <div className="eyebrow">{t(loc, "home.savings")}</div>
          <div className="big">{enoughData(km, hours) ? <><CountUp value={m.savings.pct * 100} d={1} loc={loc} /><small>%</small></> : <small>{t(loc, "home.insufficient")}</small>}</div>
          <p className="sub" dangerouslySetInnerHTML={{ __html: t(loc, "home.savingsSub", { lei: fmtMoney(loc, perMonth) }) }} />
          {m.n ? <Link className="link" href="/savings" style={{ display: "inline-block", marginTop: 10 }}>{t(loc, "sav.open")} →</Link> : null}
        </div>
        <div className="fade d1">
          <div className="eyebrow">{t(loc, "home.profit")}</div>
          <div className="big"><CountUp value={Math.round(m.avgProfit)} loc={loc} /><small>{t(loc, "cur")}</small></div>
          <p className="sub" dangerouslySetInnerHTML={{ __html: t(loc, "home.profitSub", { n: m.n, total: fmtMoney(loc, m.profit) }) }} />
        </div>
      </section>
      <Gate feature="ai" prefs={prefs} inline>
        <AskBox loc={loc} labels={{ ph: t(loc, "ask.ph"), fallback: t(loc, "ask.fallback"), ai: t(loc, "ask.ai"), error: t(loc, "ask.error") }} />
      </Gate>
      {live.length ? <Link href="/live" className="mapstrip fade d3" style={{ display: "block" }}>
        <FleetMap mode="strip" vehicles={live.map((x) => ({ ...x, track: [], done: [] }))} zones={d.zones} parcels={d.parcels} theme={prefs.theme} loc={loc} labels={mapLabels(loc)} now={DEMO_NOW_MIN} />
        <div className="hchips" aria-label={t(loc, "home.now")}>
          <span className="hc"><i className="dot mv" /><b>{moving}</b>{t(loc, "hc.moving")}</span>
          <span className="hc"><i className="dot st" /><b>{stopped}</b>{t(loc, "hc.stopped")}</span>
          {priv ? <span className="hc"><i className="dot pv" /><b>{priv}</b>{t(loc, "hc.private")}</span> : null}
          <span className="hc"><b>{fmtNum(loc, kmToday)}</b>{t(loc, "hc.km")}</span>
          {saveToday > 0 ? <span className="hc pos"><b>{fmtMoney(loc, saveToday)}</b>{t(loc, "hc.saved")}</span> : null}
          {alertsToday ? <span className="hc bad"><b>{alertsToday}</b>{t(loc, alertsToday === 1 ? "hc.alert1" : "hc.alerts")}</span> : null}
        </div>
      </Link> : null}
      {d.demo ? <ReplayTeaser loc={loc} tripId={d.views.find((v) => v.vehicleId === "bh21qrt" && v.active)?.id ?? null} /> : null}
      {rk.drivers.length >= 3 ? (
        <section className="section rk-home">
          <div className="head"><h2>{t(loc, "nav.ranking")}</h2><Link className="link" href="/ranking">{t(loc, "rk.open")} →</Link></div>
          <div className="rk-homegrid">
            <div><div className="eyebrow rk-h pos">★ {t(loc, "rk.top")}</div><div className="rk-cards">{rk.drivers.slice(0, 2).map((x, i) => <DriverCard key={x.id} d={x} loc={loc} rank={i + 1} />)}</div></div>
            {rkHelp ? <div><div className="eyebrow rk-h neg">⚑ {t(loc, "rk.help")}</div><div className="rk-cards"><DriverCard d={rkHelp} loc={loc} help /></div></div> : null}
          </div>
        </section>
      ) : null}
      <section className="section">
        <div className="head"><h2>{t(loc, "home.recent")}</h2><Link className="link" href="/trips">{t(loc, "home.all")}</Link></div>
        <TripRows rows={recent} loc={loc} />
      </section>
      {docs.length ? (
        <section className="section">
          <div className="head"><h2>{t(loc, "home.expiring")}</h2><Link className="link" href="/documents?view=cal">{t(loc, "home.allDocs")}</Link></div>
          <div className="list">
            {docs.map((x) => (
              <Link key={x.id} href={`/documents?tab=${x.scope === "driver" ? "drivers" : "vehicles"}`} className="it">
                <div><div className="t">{t(loc, `doc.${x.type}` as MsgKey)} · {docName(x)}</div><div className="m">{t(loc, "docs.expires")} {fmtDate(loc, x.expires!, true)}</div></div>
                <span className={`badge ${STATUS_CLASS[x.st.status]}`}>{x.st.days < 0 ? t(loc, "dc.expired", { n: -x.st.days }) : t(loc, "docs.days", { n: plural(loc, x.st.days, "u.day") })}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section className="section">
        <div className="head"><h2>{t(loc, "home.attn")}</h2><Link className="link" href="/alerts">{t(loc, "home.allAlerts")}</Link></div>
        {d.alerts.length ? <AlertList alerts={d.alerts.slice(0, 3)} vehicles={d.vehicles} loc={loc} /> : <p className="sub">{t(loc, "home.noAlerts")}</p>}
      </section>
    </main>
  );
}
