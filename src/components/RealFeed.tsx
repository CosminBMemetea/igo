"use client";
// Fluxul patronului pentru firmele reale: jurnalul șoferilor (tură, pauză privată, încărcat/descărcat, așteptare, alimentare).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { feedUI } from "@/lib/feed-ui-i18n";
import { FeedChips, FeedEmpty, LiveNow, QuickActions } from "./FeedBits";
import type { Locale } from "@/lib/i18n";
import type { DriverEventRow } from "@/lib/store/types";
import type { LiveVehicle } from "@/lib/query";
import { localNow } from "@/lib/validate";

const L = {
  ro: { eyebrow: "Azi · actualizat la 15 s", title: "Ce se întâmplă acum", sub: "Evenimentele trimise de șoferi din aplicație, cele mai noi primele.", empty: "Încă nimic azi. Când un șofer începe tura din aplicație, apare aici.", onShift: "în tură", km: "km azi", priv: "în pauză", map: "Hartă live", today: "Azi", yday: "Ieri",
    k: { truck_switch: "a trecut pe", shift_start: "a început tura", shift_end: "a încheiat tura", private_on: "a intrat în pauză (Privat)", private_off: "a revenit din pauză", loaded: "a încărcat", unloaded: "a descărcat", wait_start: "așteaptă la client", wait_end: "a terminat așteptarea", fill: "a alimentat" } },
  en: { eyebrow: "Today · updated every 15 s", title: "What's happening now", sub: "Events sent by drivers from the app, newest first.", empty: "Nothing yet today. When a driver starts a shift in the app, it shows up here.", onShift: "on shift", km: "km today", priv: "on break", map: "Live map", today: "Today", yday: "Yesterday",
    k: { truck_switch: "switched to", shift_start: "started the shift", shift_end: "ended the shift", private_on: "went on a break (Private)", private_off: "is back from the break", loaded: "loaded", unloaded: "unloaded", wait_start: "is waiting at the client", wait_end: "finished waiting", fill: "refuelled" } },
  pl: { eyebrow: "Dziś · aktualizacja co 15 s", title: "Co się dzieje teraz", sub: "Zdarzenia wysłane przez kierowców z aplikacji, najnowsze na górze.", empty: "Dziś jeszcze nic. Gdy kierowca rozpocznie zmianę w aplikacji, pojawi się tutaj.", onShift: "na zmianie", km: "km dziś", priv: "na przerwie", map: "Mapa na żywo", today: "Dziś", yday: "Wczoraj",
    k: { truck_switch: "przesiadł się na", shift_start: "rozpoczął zmianę", shift_end: "zakończył zmianę", private_on: "zrobił przerwę (Prywatnie)", private_off: "wrócił z przerwy", loaded: "załadował", unloaded: "rozładował", wait_start: "czeka u klienta", wait_end: "zakończył oczekiwanie", fill: "zatankował" } },
} as const;
const IC: Record<DriverEventRow["kind"], string> = { truck_switch: "⇄", shift_start: "▶", shift_end: "■", private_on: "☾", private_off: "☀", loaded: "⬆", unloaded: "⬇", wait_start: "⏳", wait_end: "✓", fill: "⛽" };

const GROUP: Record<DriverEventRow["kind"], "shift" | "brk" | "cargo" | "fuel"> = { truck_switch: "shift", shift_start: "shift", shift_end: "shift", private_on: "brk", private_off: "brk", loaded: "cargo", unloaded: "cargo", wait_start: "cargo", wait_end: "cargo", fill: "fuel" };

export function RealFeed({ loc, events, live, names, people = {}, stamp = "" }: { people?: Record<string, string>; loc: Locale; events: DriverEventRow[]; live: LiveVehicle[]; names: Record<string, { plate: string; driver: string }>; stamp?: string }) {
  const T = L[loc] ?? L.ro, U = feedUI(loc), today = localNow().slice(0, 10);
  const on = live.filter((x) => x.onShift).length, priv = live.filter((x) => x.status === "private").length, km = live.reduce((a, x) => a + x.today, 0);
  const [kind, setKind] = useState("all"), [truck, setTruck] = useState(""), [open, setOpen] = useState<string | null>(null);
  // evenimentele noi (după reîmprospătarea de 15 s) intră animat
  const seen = useRef<Set<string> | null>(null), [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = events.map((e) => e.id);
    if (seen.current) { const n = ids.filter((id) => !seen.current!.has(id)); if (n.length) setFresh(new Set(n)); }
    seen.current = new Set(ids);
  }, [events]);
  const kinds = useMemo(() => {
    const c = { shift: 0, brk: 0, cargo: 0, fuel: 0 }; for (const e of events) if (!truck || e.truckId === truck) c[GROUP[e.kind]]++;
    return [{ id: "all", label: U.all, n: 0 }, { id: "shift", label: U.shift, n: c.shift }, { id: "cargo", label: U.cargo, n: c.cargo }, { id: "fuel", label: U.fuel, n: c.fuel }, { id: "brk", label: U.brk, n: c.brk }];
  }, [events, truck, U]);
  const trucks = useMemo(() => [...new Set(events.map((e) => e.truckId))].map((id) => ({ id, label: names[id]?.plate ?? "—" })).sort((a, b) => a.label.localeCompare(b.label)), [events, names]);
  const shown = events.filter((e) => (kind === "all" || GROUP[e.kind] === kind) && (!truck || e.truckId === truck));
  const nowMs = Date.parse(stamp) || 0;
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
        <LiveNow U={U} stamp={stamp} />
        {events.length ? <FeedChips U={U} kinds={kinds} kind={kind} setKind={setKind} trucks={trucks} truck={truck} setTruck={setTruck} /> : null}
        {!events.length ? <div className="rfempty fade d2"><span aria-hidden>🚚</span><p>{T.empty}</p></div>
          : !shown.length ? <FeedEmpty U={U} onReset={() => { setKind("all"); setTruck(""); }} />
          : <ol className="rfeed">{shown.map((e, ix) => {
          const l = localNow(new Date(e.at)), day = l.slice(0, 10), n = names[e.truckId], isOpen = open === e.id;
          const recent = nowMs && nowMs - Date.parse(e.at) < 15 * 60000;
          const prev = ix ? localNow(new Date(shown[ix - 1].at)).slice(0, 10) : "";
          const head = day !== prev ? (<li className="rfday" key={"d" + day}>{day === today ? T.today : T.yday}</li>) : null;
          return [head, <li key={e.id} className={`rfe k-${e.kind}${fresh.has(e.id) ? " fresh" : ""}${isOpen ? " open" : ""}`}>
            <button type="button" className="rfrow" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>
              <i aria-hidden>{IC[e.kind]}</i>
              <div><b>{(e.userId && people[e.userId]) || n?.driver || n?.plate || "—"}</b> {T.k[e.kind]}{e.note ? (e.kind === "truck_switch" ? <b> {e.note}</b> : <span className="rfn"> · {e.note}</span>) : null}<small>{n?.plate}</small></div>
              <time>{recent ? <em className="rfnow">{U.now}</em> : null}{l.slice(11, 16)}</time>
            </button>
            {isOpen ? <QuickActions U={U} truckId={e.truckId} day={day} /> : null}
          </li>];
        })}</ol>}
        <Link className="link" href="/live" style={{ display: "inline-block", marginTop: 18 }}>{T.map} →</Link>
      </div>
    </main>
  );
}
