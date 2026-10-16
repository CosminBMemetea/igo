// Fluxul patronului pentru firmele reale: jurnalul șoferilor (tură, pauză privată, încărcat/descărcat, așteptare, alimentare).
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import type { DriverEventRow } from "@/lib/store/types";
import type { LiveVehicle } from "@/lib/query";
import { localNow } from "@/lib/validate";

const L = {
  ro: { eyebrow: "Flux live", title: "Ce se întâmplă acum", sub: "Evenimentele trimise de șoferi din aplicație, cele mai noi primele.", empty: "Încă nimic azi. Când un șofer începe tura din aplicație, apare aici.", onShift: "în tură", km: "km azi", priv: "în pauză", map: "Hartă live", today: "Azi", yday: "Ieri",
    k: { truck_switch: "a trecut pe", shift_start: "a început tura", shift_end: "a încheiat tura", private_on: "a intrat în pauză (Privat)", private_off: "a revenit din pauză", loaded: "a încărcat", unloaded: "a descărcat", wait_start: "așteaptă la client", wait_end: "a terminat așteptarea", fill: "a alimentat" } },
  en: { eyebrow: "Live feed", title: "What's happening now", sub: "Events sent by drivers from the app, newest first.", empty: "Nothing yet today. When a driver starts a shift in the app, it shows up here.", onShift: "on shift", km: "km today", priv: "on break", map: "Live map", today: "Today", yday: "Yesterday",
    k: { truck_switch: "switched to", shift_start: "started the shift", shift_end: "ended the shift", private_on: "went on a break (Private)", private_off: "is back from the break", loaded: "loaded", unloaded: "unloaded", wait_start: "is waiting at the client", wait_end: "finished waiting", fill: "refuelled" } },
  pl: { eyebrow: "Na żywo", title: "Co się dzieje teraz", sub: "Zdarzenia wysłane przez kierowców z aplikacji, najnowsze na górze.", empty: "Dziś jeszcze nic. Gdy kierowca rozpocznie zmianę w aplikacji, pojawi się tutaj.", onShift: "na zmianie", km: "km dziś", priv: "na przerwie", map: "Mapa na żywo", today: "Dziś", yday: "Wczoraj",
    k: { truck_switch: "przesiadł się na", shift_start: "rozpoczął zmianę", shift_end: "zakończył zmianę", private_on: "zrobił przerwę (Prywatnie)", private_off: "wrócił z przerwy", loaded: "załadował", unloaded: "rozładował", wait_start: "czeka u klienta", wait_end: "zakończył oczekiwanie", fill: "zatankował" } },
} as const;
const IC: Record<DriverEventRow["kind"], string> = { truck_switch: "⇄", shift_start: "▶", shift_end: "■", private_on: "☾", private_off: "☀", loaded: "⬆", unloaded: "⬇", wait_start: "⏳", wait_end: "✓", fill: "⛽" };

export function RealFeed({ loc, events, live, names, people = {} }: { people?: Record<string, string>; loc: Locale; events: DriverEventRow[]; live: LiveVehicle[]; names: Record<string, { plate: string; driver: string }> }) {
  const T = L[loc] ?? L.ro, today = localNow().slice(0, 10);
  const on = live.filter((x) => x.onShift).length, priv = live.filter((x) => x.status === "private").length, km = live.reduce((a, x) => a + x.today, 0);
  let lastDay = "";
  return (
    <main className="fpage">
      <div className="fcol">
        <div className="eyebrow fade"><span className="flive" />{T.eyebrow}</div>
        <h1 className="h1 fade">{T.title}</h1>
        <p className="sub fade d1">{T.sub}</p>
        <div className="rfsum fade d1">
          <div><b>{on}<small>/{live.length}</small></b><span>{T.onShift}</span></div>
          <div><b>{Math.round(km)}</b><span>{T.km}</span></div>
          <div><b>{priv}</b><span>{T.priv}</span></div>
        </div>
        {events.length ? <ol className="rfeed fade d2">{events.map((e) => {
          const l = localNow(new Date(e.at)), day = l.slice(0, 10), n = names[e.truckId];
          const head = day !== lastDay ? (lastDay = day, <li className="rfday" key={"d" + day}>{day === today ? T.today : T.yday}</li>) : null;
          return [head, <li key={e.id} className={`rfe k-${e.kind}`}>
            <i aria-hidden>{IC[e.kind]}</i>
            <div><b>{(e.userId && people[e.userId]) || n?.driver || n?.plate || "—"}</b> {T.k[e.kind]}{e.note ? (e.kind === "truck_switch" ? <b> {e.note}</b> : <span className="rfn"> · {e.note}</span>) : null}<small>{n?.plate}</small></div>
            <time>{l.slice(11, 16)}</time>
          </li>];
        })}</ol> : <p className="rfempty fade d2">{T.empty}</p>}
        <Link className="link" href="/live" style={{ display: "inline-block", marginTop: 18 }}>{T.map} →</Link>
      </div>
    </main>
  );
}
