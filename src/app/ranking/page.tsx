import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { t, fmtNum, type MsgKey } from "@/lib/i18n";
import { rankings, type Comp } from "@/lib/ranking";
import { todayFor } from "@/lib/today";
import { EmptyState } from "@/components/EmptyState";
import { DriverCard, ScoreRing, TruckBars } from "@/components/Ranking";

export const dynamic = "force-dynamic";
const COLS: Comp[] = ["cons", "harsh", "speed", "idle", "ontime", "alerts"];
export default async function Ranking() {
  const { loc } = getPrefs();
  const d = await load();
  const R = rankings(d.vehicles, d.views, d.alerts, todayFor(d.demo), d.demo);
  if (!R.drivers.length) return <main><EmptyState kind="home" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const top = R.drivers.slice(0, 3), help = R.drivers.filter((x) => x.worst && x.score < 75).slice(-3).reverse();
  const cols = COLS.filter((c) => R.telematics || c === "cons" || c === "alerts");
  return (
    <main className="rk-page">
      <div className="eyebrow fade">{t(loc, "rk.eyebrow")}</div>
      <h1 className="h1 fade">{t(loc, "rk.title")}</h1>
      <p className="sub fade d1">{t(loc, R.telematics ? "rk.sub" : "rk.subReal")}</p>
      <div className="rk-two fade d1">
        <section><div className="eyebrow rk-h pos">★ {t(loc, "rk.top")}</div><div className="rk-cards">{top.map((x, i) => <DriverCard key={x.id} d={x} loc={loc} rank={i + 1} />)}</div></section>
        {help.length ? <section><div className="eyebrow rk-h neg">⚑ {t(loc, "rk.help")}</div><div className="rk-cards">{help.map((x) => <DriverCard key={x.id} d={x} loc={loc} help />)}</div></section> : null}
      </div>
      <section className="section fade d2">
        <div className="head"><h2>{t(loc, "rk.trucks")}</h2></div>
        <TruckBars rows={R.trucks} avg={R.fleetAvg} loc={loc} />
      </section>
      <section className="section fade d3">
        <div className="head"><h2>{t(loc, "rk.all")}</h2></div>
        <div className="rk-table" role="table">
          <div className="rk-tr th" role="row"><span>#</span><span>{t(loc, "rk.driver")}</span><span>{t(loc, "rk.score")}</span>{cols.map((c) => <span key={c} className="c">{t(loc, `rk.c.${c}` as MsgKey)}</span>)}</div>
          {R.drivers.map((x, i) => (
            <div key={x.id} className="rk-tr" role="row">
              <span className="rk-pos">{i + 1}</span>
              <span className="nm"><b>{x.driver}</b><small>{x.plate}</small></span>
              <span><ScoreRing s={x.score} size={38} /></span>
              {cols.map((c) => {
                const p = x.parts[c], v = c === "cons" ? (x.l100 != null ? fmtNum(loc, x.l100, 1) : "—") : c === "harsh" ? fmtNum(loc, x.harsh ?? 0, 1) : c === "speed" ? `${fmtNum(loc, x.speeding ?? 0, 1)}%` : c === "idle" ? `${fmtNum(loc, x.idle ?? 0, 1)}%` : c === "ontime" ? `${x.onTime}%` : String(x.alerts);
                return <span key={c} className={`c ${p == null ? "" : p >= 0.75 ? "pos" : p < 0.5 ? "neg" : ""}`}>{v}</span>;
              })}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
