import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { monthSummary } from "@/lib/query";
import { enoughData } from "@/lib/calc";
import { fmtMoney, t } from "@/lib/i18n";
import { mapLabels } from "@/lib/labels";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import { CountUp } from "@/components/CountUp";
import { AskBox } from "@/components/AskBox";
import FleetMap from "@/components/FleetMap";
import { Gate } from "@/components/Gate";
import { TripRows } from "./TripRows";
import { AlertList } from "./AlertList";

export const dynamic = "force-dynamic";
export default async function Home() {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  const m = monthSummary(d.views);
  const live = d.live();
  const km = d.views.filter((v) => !v.active).reduce((s, v) => s + v.km, 0), hours = d.views.filter((v) => !v.active).reduce((s, v) => s + v.hours, 0);
  const recent = [...d.views.filter((v) => v.active).slice(0, 2), ...d.views.filter((v) => !v.active).slice(0, 4)];
  const moving = live.filter((x) => x.status === "moving" || x.status === "working").length;
  return (
    <main>
      <section className="hero">
        <div className="fade">
          <div className="eyebrow">{t(loc, "home.savings")}</div>
          <div className="big">{enoughData(km, hours) ? <><CountUp value={m.savings.pct * 100} d={1} loc={loc} /><small>%</small></> : <small>{t(loc, "home.insufficient")}</small>}</div>
          <p className="sub" dangerouslySetInnerHTML={{ __html: t(loc, "home.savingsSub", { lei: fmtMoney(loc, m.savings.savedLei) }) }} />
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
      <Link href="/live" className="mapstrip fade d3" style={{ display: "block" }}>
        <FleetMap mode="strip" vehicles={live} zones={d.zones} parcels={d.parcels} theme={prefs.theme} loc={loc} labels={mapLabels(loc)} now={DEMO_NOW_MIN} />
        <span className="chip" style={{ left: "5%", top: "10%", zIndex: 500 }}><b>{t(loc, "home.now")}</b><span>{moving} / {live.length}</span></span>
      </Link>
      <section className="section">
        <div className="head"><h2>{t(loc, "home.recent")}</h2><Link className="link" href="/trips">{t(loc, "home.all")}</Link></div>
        <TripRows rows={recent} loc={loc} />
      </section>
      <section className="section">
        <div className="head"><h2>{t(loc, "home.attn")}</h2><Link className="link" href="/alerts">{t(loc, "home.allAlerts")}</Link></div>
        <AlertList alerts={d.alerts.slice(0, 3)} vehicles={d.vehicles} loc={loc} />
      </section>
    </main>
  );
}
