import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { t, tri, fmtNum, type MsgKey } from "@/lib/i18n";
import { store } from "@/lib/store";
import { driverActivity } from "@/lib/driver-progress";
import { splitRank, rankings, type Comp } from "@/lib/ranking";
import { todayFor } from "@/lib/today";
import { EmptyState } from "@/components/EmptyState";
import { DriverCard, ScoreRing, TruckBars } from "@/components/Ranking";
import { DemoBadge } from "@/components/DemoBadge";

export const dynamic = "force-dynamic";
const COLS: Comp[] = ["cons", "harsh", "speed", "idle", "ontime", "alerts"];
export default async function Ranking() {
  const { loc } = (await getPrefs());
  const d = await load();
  const R = rankings(d.vehicles, d.views, d.alerts, todayFor(d.demo), d.demo);
  if (!d.demo && d.tn.firm) {
    const [users, trips] = await Promise.all([store().users(d.tn.firm.id), store().trips(d.tn.firm.id)]);
    const activity = driverActivity(users, trips, todayFor(false));
    return <main className="rk-page"><h1 className="h1">{tri(loc, "Activitatea șoferilor|Driver activity|Aktywność kierowców")}</h1>
      <p className="sub">{tri(loc, "Livrări cu POD în ultimele 30 de zile, atribuite șoferului cursei. Egalitățile au același loc. Nu este un scor de siguranță; volumul depinde și de alocările firmei.|Deliveries with POD in the last 30 days, attributed to each trip's driver. Ties share a rank. This is not a safety score; volume also depends on company assignments.|Dostawy z POD w ostatnich 30 dniach, przypisane kierowcy kursu. Remisy mają wspólne miejsce. To nie ocena bezpieczeństwa; liczba zależy też od przydziałów firmy.")}</p>
      {activity.participants < 3 ? <p className="hint">{tri(loc, "Locurile apar de la 3 șoferi cu livrări documentate în această perioadă.|Ranks appear from 3 drivers with documented deliveries in this period.|Miejsca pojawiają się od 3 kierowców z udokumentowanymi dostawami w tym okresie.")}</p> : null}
      <div className="list">{activity.rows.map(row => <section className="sheet" key={row.id}><div className="head"><h2>{row.rank ? `#${row.rank} · ` : ""}{row.name}</h2><strong>{row.completed} POD</strong></div><p className="hint">{row.lifetime} {tri(loc, "livrări documentate în total · distincții la 1, 5, 10 și 25|documented deliveries overall · badges at 1, 5, 10 and 25|udokumentowanych dostaw łącznie · odznaki przy 1, 5, 10 i 25")}</p></section>)}</div>
      {!activity.rows.length ? <p className="sub">{tri(loc, "Nu ai încă șoferi cu acces activ.|No drivers with active access yet.|Brak kierowców z aktywnym dostępem.")}</p> : null}
      <section className="section"><h2>{t(loc, "rk.trucks")}</h2><p className="hint">{tri(loc, "Rate declarate/estimate pe camion. Nu le atribuim automat șoferului curent.|Declared/estimated rates by truck. We do not automatically attribute them to the current driver.|Zadeklarowane/szacowane zużycie pojazdu. Nie przypisujemy go automatycznie obecnemu kierowcy.")}</p><TruckBars rows={R.trucks} avg={R.fleetAvg} loc={loc} /></section>
    </main>;
  }
  if (!R.drivers.length) return <main><EmptyState kind="home" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const { top, help, few } = splitRank(R.drivers);
  const cols = COLS.filter((c) => (d.demo && R.telematics) || c === "cons" || c === "alerts");
  return (
    <main className="rk-page">
      <div className="eyebrow fade">{t(loc, "rk.eyebrow")} {d.demo ? <DemoBadge loc={loc} /> : null}</div>
      <h1 className="h1 fade">{t(loc, "rk.title")}</h1>
      <p className="sub fade d1">{t(loc, R.telematics ? "rk.sub" : "rk.subReal")}</p>
      {d.demo && R.telematics ? <p className="hint rk-note fade d1">{tri(loc, "Exemplu demo. Necesită GPS cu senzori (cutie CAN) sau date de la producătorul camionului.|Demo example. Requires GPS with sensors (CAN box) or data from the truck manufacturer.|Przykład demo. Wymaga GPS z czujnikami (moduł CAN) lub danych od producenta ciężarówki.")}</p> : null}
      {few ? <p className="rk-few fade d1">{t(loc, "rk.few")}</p> : null}
      <div className="rk-two fade d1">
        {top.length ? <section><div className="eyebrow rk-h pos">★ {t(loc, "rk.top")}</div><div className="rk-cards">{top.map((x, i) => <DriverCard key={x.id} d={x} loc={loc} rank={i + 1} />)}</div></section> : null}
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
