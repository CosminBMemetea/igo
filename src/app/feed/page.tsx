import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { buildFeed } from "@/lib/feed";
import { FT, fill } from "@/lib/feed-i18n";
import { rankings } from "@/lib/ranking";
import { todayFor } from "@/lib/today";
import { demoReactions } from "@/lib/demo-shift";
import { fmtNum, t } from "@/lib/i18n";
import { Feed } from "@/components/Feed";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";
export default async function FeedPage() {
  const { loc } = getPrefs(), F = FT[loc];
  const d = await load();
  if (!d.demo) return <main><EmptyState kind="live" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const today = todayFor(d.demo), live = d.live();
  const rk = rankings(d.vehicles, d.views, d.alerts, today, d.demo);
  const f = buildFeed({ loc, vehicles: d.vehicles, views: d.views, clients: d.clients, alerts: d.alerts, live, drivers: rk.drivers });
  const s = f.summary;
  return (
    <main className="fpage">
      <div className="fcol">
        <div className="eyebrow fade"><span className="flive" />{F.eyebrow}</div>
        <h1 className="h1 fade">{F.title}</h1>
        <p className="sub fade d1">{F.sub}</p>
        <Feed data={{ pinned: f.pinned, events: f.events, queue: f.queue, stories: f.stories, now: f.now }} F={F} reacted={demoReactions().map((r) => r.id)} demo={d.demo} />
      </div>
      <aside className="fside">
        <div className="fsum">
          <div className="eyebrow">{F.sideToday}</div>
          <div className="fsgrid">
            <div><b>{s.moving}<small>/{s.total}</small></b><span>{F.sMoving}</span></div>
            <div><b>{fmtNum(loc, s.km)}</b><span>{F.sKm}</span></div>
            <div><b>{s.fills}</b><span>{F.sFills}</span></div>
            <div className={s.alerts ? "bad" : ""}><b>{s.alerts}</b><span>{F.sAlerts}</span></div>
          </div>
          {s.next.length ? <><div className="eyebrow" style={{ marginTop: 22 }}>{F.sNext}</div><ul className="fnext">{s.next.map((x) => <li key={x.plate}><b>{x.plate}</b><span>{x.dest}</span><time>{x.eta}</time></li>)}</ul></> : null}
          {s.top ? <><div className="eyebrow" style={{ marginTop: 22 }}>{F.sTop}</div><p className="ftop">🍃 <b>{s.top.driver}</b> · {s.top.plate} · {s.top.rate} L/100</p></> : null}
          <Link className="link" href="/live" style={{ display: "inline-block", marginTop: 16 }}>{t(loc, "nav.live")} →</Link>
        </div>
      </aside>
    </main>
  );
}
