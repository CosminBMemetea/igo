import Link from "next/link";
import { realSpeedParts } from "@/lib/speed-report";
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
import { speedRanking, SPEED_MIN_KM } from "@/lib/speed";

export const dynamic = "force-dynamic";
const COLS: Comp[] = ["cons", "harsh", "speed", "idle", "ontime", "alerts"];
export default async function Ranking() {
  const { loc } = (await getPrefs());
  const d = await load();
  const R = rankings(d.vehicles, d.views, d.alerts, todayFor(d.demo), d.demo, await realSpeedParts(store(), d.tn.firm?.id, d.demo));
  if (!d.demo && d.tn.firm) {
    const [users, trips] = await Promise.all([store().users(d.tn.firm.id), store().trips(d.tn.firm.id)]);
    const activity = driverActivity(users, trips, todayFor(false));
    const events = await store().speedEvents(d.tn.firm.id, { sinceAt: new Date(Date.parse(activity.since) - 86400_000).toISOString() /* speedRanking filters by Bucharest day */, limit: 5000 });
    const speedRows = speedRanking(users.filter(u => u.role === "driver" && !u.disabledAt), trips, events, activity.since);
    return <main className="rk-page"><h1 className="h1">{tri(loc, "Activitatea șoferilor|Driver activity|Aktywność kierowców")}</h1>
      <p className="sub">{tri(loc, "Livrări cu POD în ultimele 30 de zile, atribuite șoferului cursei. Egalitățile au același loc. Nu este un scor de siguranță; volumul depinde și de alocările firmei.|Deliveries with POD in the last 30 days, attributed to each trip's driver. Ties share a rank. This is not a safety score; volume also depends on company assignments.|Dostawy z POD w ostatnich 30 dniach, przypisane kierowcy kursu. Remisy mają wspólne miejsce. To nie ocena bezpieczeństwa; liczba zależy też od przydziałów firmy.")}</p>
      {activity.participants < 3 ? <p className="hint">{tri(loc, "Locurile apar de la 3 șoferi cu livrări documentate în această perioadă.|Ranks appear from 3 drivers with documented deliveries in this period.|Miejsca pojawiają się od 3 kierowców z udokumentowanymi dostawami w tym okresie.")}</p> : null}
      <div className="list">{activity.rows.map(row => <section className="sheet" key={row.id}><div className="head"><h2>{row.rank ? `#${row.rank} · ` : ""}{row.name}</h2><strong>{row.completed} POD</strong></div><p className="hint">{row.lifetime} {tri(loc, "livrări documentate în total · distincții la 1, 5, 10 și 25|documented deliveries overall · badges at 1, 5, 10 and 25|udokumentowanych dostaw łącznie · odznaki przy 1, 5, 10 i 25")}</p></section>)}</div>
      {!activity.rows.length ? <p className="sub">{tri(loc, "Nu ai încă șoferi cu acces activ.|No drivers with active access yet.|Brak kierowców z aktywnym dostępem.")}</p> : null}
      <section className="section" id="speed"><h2>{tri(loc, "Depășiri ale limitei setate|Set-limit warnings|Przekroczenia ustawionego limitu")}</h2>
        <p className="hint">{tri(loc, `Evenimente la 100 km, ultimele 30 de zile, din GPS-ul telefonului. Apare doar pentru șoferii cu cel puțin ${SPEED_MIN_KM} km în curse finalizate. Mai puțin = mai bine.|Events per 100 km, last 30 days, from the phone GPS. Shown only for drivers with at least ${SPEED_MIN_KM} km on finished trips. Lower is better.|Zdarzenia na 100 km, ostatnie 30 dni, z GPS telefonu. Tylko dla kierowców z co najmniej ${SPEED_MIN_KM} km w zakończonych kursach. Mniej = lepiej.`)}</p>
        {speedRows.length ? <div className="sheet" style={{ overflowX: "auto" }}><table className="rk-speed"><thead><tr><th>{tri(loc, "Șofer|Driver|Kierowca")}</th><th>km</th><th>{tri(loc, "Ev.|Ev.|Zd.")}</th><th>/100 km</th></tr></thead><tbody>{speedRows.map(r => <tr key={r.id}><td>{r.name}</td><td>{fmtNum(loc, r.km)}</td><td>{r.ex!.events}</td><td>{fmtNum(loc, r.ex!.per100, 1)}</td></tr>)}</tbody></table></div>
          : <p className="sub">{tri(loc, "Încă nu sunt destule date.|Not enough data yet.|Za mało danych.")}</p>}
        <Link className="link" href="/speeding">{tri(loc, "Vezi raportul|Open the report|Otwórz raport")} →</Link>
      </section>
      <section className="section" id="score"><h2>{tri(loc, "Scor orientativ|Indicative score|Wynik orientacyjny")}</h2>
        <p className="sub">{t(loc, "rk.subReal")}</p>
        {R.drivers.length ? <><div className="rk-table rk-real" role="table">
          <div className="rk-tr th" role="row"><span>{t(loc, "rk.driver")}</span><span title={t(loc, "rk.score")}>{t(loc, "rk.score")}</span>{/* short labels so nothing breaks mid-word at 320 px; full text in title/aria-label */}<span className="c" title={`${t(loc, "rk.c.cons")} (L/100 km)`} aria-label={`${t(loc, "rk.c.cons")} (L/100 km)`}>{tri(loc, "Consum|Fuel|Paliwo")}<small>L/100 km</small></span><span className="c" title={`${t(loc, "rk.c.speed")} (${tri(loc, "ev./100 km|ev./100 km|zd./100 km")})`} aria-label={`${t(loc, "rk.c.speed")} (${tri(loc, "ev./100 km|ev./100 km|zd./100 km")})`}>{tri(loc, "Viteză|Speed|Prędk.")}<small>{tri(loc, "ev./100 km|ev./100 km|zd./100 km")}</small></span><span className="c" title={t(loc, "rk.c.alerts")}>{t(loc, "rk.c.alerts")}</span></div>
          {R.drivers.map((x, i) => { const cls = (p?: number) => `c ${p == null ? "" : p >= 0.75 ? "pos" : p < 0.5 ? "neg" : ""}`; return (
            <div key={x.id} className="rk-tr" role="row">
              <span className="nm"><b>{i + 1}. {x.driver}</b><small>{x.plate}</small></span>
              <span><ScoreRing s={x.score} size={34} /></span>
              <span className={cls(x.parts.cons)}>{x.l100 != null ? fmtNum(loc, x.l100, 1) : "—"}</span>
              <span className={cls(x.parts.speed)} title={x.speedPer100 == null ? tri(loc, `Sub ${SPEED_MIN_KM} km în curse finalizate|Under ${SPEED_MIN_KM} km on finished trips|Poniżej ${SPEED_MIN_KM} km w zakończonych kursach`) : undefined}>{x.speedPer100 != null ? fmtNum(loc, x.speedPer100, 1) : "—"}</span>
              <span className={cls(x.parts.alerts)}>{x.alerts}</span>
            </div>); })}
        </div>
        <p className="hint">{tri(loc, `Pe șofer, din cursele lui finalizate în ultimele 30 de zile; sub nume, camionul cu care a condus cel mai mult. Viteză = depășiri ale limitei setate la 100 km (GPS telefon), intră în scor doar de la ${SPEED_MIN_KM} km; „—” = încă prea puțini km.|Per driver, from their trips finished in the last 30 days; under the name, the truck they drove most. Speed = set-limit warnings per 100 km (phone GPS), counted in the score only from ${SPEED_MIN_KM} km; “—” = not enough km yet.|Na kierowcę, z jego kursów zakończonych w ostatnich 30 dniach; pod nazwiskiem pojazd, którym jeździł najwięcej. Prędkość = przekroczenia ustawionego limitu na 100 km (GPS telefonu), liczone w wyniku dopiero od ${SPEED_MIN_KM} km; „—” = za mało km.`)}</p></>
          : <p className="sub">{t(loc, "rk.noData")}</p>}
      </section>
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
