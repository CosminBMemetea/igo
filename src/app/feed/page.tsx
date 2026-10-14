import { EconKpis } from "@/components/Econ";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { buildFeed } from "@/lib/feed";
import { FT, fill } from "@/lib/feed-i18n";
import { rankings } from "@/lib/ranking";
import { todayFor } from "@/lib/today";
import { demoReactions, demoResolved } from "@/lib/demo-shift";
import { fmtNum, t } from "@/lib/i18n";
import { RealFeed } from "@/components/RealFeed";
import { AutoRefresh } from "@/components/AutoRefresh";
import { store } from "@/lib/store";
import { dayStartIso } from "@/lib/driver-log";
import { Feed } from "@/components/Feed";

export const dynamic = "force-dynamic";
export default async function FeedPage() {
  const { loc } = getPrefs(), F = FT[loc];
  const d = await load();
  if (!d.demo) {
    // firmă reală: jurnalul șoferilor din ultimele ~2 zile + starea live (reîmprospătat la 30 s)
    if (!d.tn.firm) redirect("/");
    const [ev, lv] = await Promise.all([store().driverEvents(d.tn.firm.id, new Date(Date.parse(dayStartIso()) - 86400000).toISOString()).catch(() => []), d.live()]);
    const names = Object.fromEntries(d.allVehicles.map((v) => [v.id, { plate: v.name, driver: v.driver }]));
    const people = Object.fromEntries((await store().users(d.tn.firm.id).catch(() => [])).map((u) => [u.id, u.name]));
    return <><RealFeed loc={loc} events={ev.slice(0, 120)} live={lv} names={names} people={people} /><AutoRefresh ms={30000} /></>;
  }
  const today = todayFor(d.demo), live = (await d.live());
  const rk = rankings(d.vehicles, d.views, d.alerts, today, d.demo);
  const f = buildFeed({ loc, vehicles: d.vehicles, views: d.views, clients: d.clients, alerts: d.alerts, live, drivers: rk.drivers });
  const s = f.summary, rs = demoResolved();
  const openN = [...f.pinned, ...f.events.filter((e) => e.kind === "idle")].filter((e) => !rs[e.id]).length;
  return (
    <main className="fpage">
      <div className="fcol">
        <div className="eyebrow fade"><span className="flive" />{F.eyebrow}</div>
        <h1 className="h1 fade">{F.title}</h1>
        <p className="sub fade d1">{F.sub}</p>
        <div className="fecon-m"><EconKpis vehicles={d.vehicles} views={d.views} loc={loc} compact /></div>
        <Feed data={{ pinned: f.pinned, events: f.events, queue: f.queue, stories: f.stories, now: f.now }} F={F} reacted={demoReactions().map((r) => r.id)} demo={d.demo} resolved={Object.fromEntries(Object.entries(rs).map(([k, v]) => [k, { a: v.a, ...(v.n ? { n: v.n } : {}) }]))} />
      </div>
      <aside className="fside">
        <div className="fecon-d"><EconKpis vehicles={d.vehicles} views={d.views} loc={loc} compact /></div>
        <div className="fsum">
          <div className="eyebrow">{F.sideToday}</div>
          <div className="fsgrid">
            <div><b>{s.moving}<small>/{s.total}</small></b><span>{F.sMoving}</span></div>
            <div><b>{fmtNum(loc, s.km)}</b><span>{F.sKm}</span></div>
            <div><b>{s.fills}</b><span>{F.sFills}</span></div>
            <div className={openN ? "bad" : ""}><b>{openN}</b><span>{F.sAlerts}</span></div>
          </div>
          {s.next.length ? <><div className="eyebrow" style={{ marginTop: 22 }}>{F.sNext}</div><ul className="fnext">{s.next.map((x) => <li key={x.plate}><b>{x.plate}</b><span>{x.dest}</span><time>{x.eta}</time></li>)}</ul></> : null}
          {s.top ? <><div className="eyebrow" style={{ marginTop: 22 }}>{F.sTop}</div><p className="ftop">🍃 <b>{s.top.driver}</b> · {s.top.plate} · {s.top.rate} L/100</p></> : null}
          <Link className="link" href="/live" style={{ display: "inline-block", marginTop: 16 }}>{t(loc, "nav.live")} →</Link>
        </div>
      </aside>
    </main>
  );
}
