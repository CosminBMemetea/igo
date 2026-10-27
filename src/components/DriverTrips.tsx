"use client";
import Link from "next/link";
import { outboxItems, type OutboxItem } from "@/lib/outbox";
import { applyDriverTripUpdate, DRIVER_TRIP_UPDATE, type DriverTripUpdate } from "@/lib/driver-trip-update";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent, type TouchEvent } from "react";
import { countTri, tri, fmtDate, type Locale } from "@/lib/i18n";
import { groupDriverTrips, driverTripStage, type DriverTripSummary, type DriverTripStage } from "@/lib/driver-trips";
import { tripChecklist, driverSections, CHECK_LABEL, CHECK_ACTION, DOC_KEYS, type TripDocs, type CheckState } from "@/lib/driver-checklist";
function TripRoute({ title, loc }: { title: string; loc: Locale }) {
  const stops = title.split(/\s+(?:→|·|–|—)\s+/);
  if (stops.length < 2) return <strong className="driver-route-title">{title}</strong>;
  return <div className="driver-route">{stops.map((stop, i) => <div className="driver-route-stop" key={i}><span className="driver-route-dot" aria-hidden="true" /><div><small>{tri(loc, i === 0 ? "Plecare|From|Wyjazd" : i === stops.length - 1 ? "Destinație|To|Cel" : "Pe traseu|Via|Przez")}</small><strong>{stop}</strong></div></div>)}</div>;
}
const SEG_KEY = "qf-driver-trips-seg";
const labels: Record<DriverTripStage, string> = {
  running: "Încărcată · în desfășurare|Loaded · in progress|Załadowany · w trakcie",
  ready: "De încărcat|Ready for loading|Do załadunku",
  upcoming: "Planificată|Scheduled|Zaplanowany",
  documents: "Livrată · lipsește POD|Delivered · POD needed|Dostarczony · brakuje POD",
  finished: "Încheiată|Completed|Zakończony",
  cancelled: "Anulată|Cancelled|Anulowany",
};
export function DriverTrips({ trips, today, truckId, trucks, loc, selectedId, embedded = false, demo = false, queueScope, docs = {}, variant = "full" }: { queueScope?: string; trips: DriverTripSummary[]; today: string; truckId?: string | null; trucks: { id: string; name: string }[]; loc: Locale; selectedId?: string; embedded?: boolean; demo?: boolean; docs?: Record<string, TripDocs>; variant?: "home" | "full" }) {
  const [queued, setQueued] = useState<OutboxItem[]>([]);
  const [readScope, setReadScope] = useState<string | null>(null), [queueError, setQueueError] = useState(false);
  const queueReady = !queueScope || demo || readScope === queueScope;
  useEffect(() => {
    if (!queueScope || demo) return;
    let alive = true, revision = 0;
    const read = () => {
      const current = ++revision;
      void outboxItems(queueScope).then(items => {
        if (!alive || current !== revision) return;
        setQueued(items); setReadScope(queueScope); setQueueError(false);
      }).catch(() => { if (alive && current === revision) { setReadScope(null); setQueueError(true); } });
    };
    read(); window.addEventListener("igo-outbox", read);
    return () => { alive = false; window.removeEventListener("igo-outbox", read); };
  }, [queueScope, demo]);
  const [updates, setUpdates] = useState<DriverTripUpdate[]>([]);
  useEffect(() => {
    if (!demo) return;
    const update = (event: Event) => { const detail = (event as CustomEvent<DriverTripUpdate>).detail; if (detail && ["loaded", "unloaded", "pod"].includes(detail.kind)) setUpdates(old => [...old, detail]); };
    window.addEventListener(DRIVER_TRIP_UPDATE, update);
    return () => window.removeEventListener(DRIVER_TRIP_UPDATE, update);
  }, [demo]);
  useEffect(() => {
    if (!queueScope || demo) return;
    const acknowledge = (event: Event) => {
      const detail = (event as CustomEvent<{ scope: string; tripId: string; kind: string; occurredAt: string }>).detail;
      if (detail?.scope === queueScope && (detail.kind === "loaded" || detail.kind === "unloaded")) {
        const update: DriverTripUpdate = { tripId: detail.tripId, kind: detail.kind, at: detail.occurredAt };
        setUpdates(old => [...old.filter(x => x.tripId !== update.tripId || x.kind !== update.kind), update]);
      }
    };
    window.addEventListener("qf-trip-server-ack", acknowledge);
    return () => window.removeEventListener("qf-trip-server-ack", acknowledge);
  }, [queueScope, demo]);
  const pendingIds = new Set(queued.filter(x => x.kind === "event").map(x => (x.payload as Record<string, string>).tripId));
  const blockedIds = new Set(queued.filter(x => x.status === "blocked").map(x => (x.payload as Record<string, string>).tripId));
  const localUpdates: DriverTripUpdate[] = [];
  for (const item of queued) {
    const event = item.payload as Record<string, string>;
    if (item.kind === "event" && item.status === "pending" && !blockedIds.has(event.tripId) && (event.kind === "loaded" || event.kind === "unloaded"))
      localUpdates.push({ tripId: event.tripId, kind: event.kind, at: event.occurredAt });
  }
  const visibleTrips = trips.map(trip => (demo ? updates : [...updates, ...localUpdates]).reduce(applyDriverTripUpdate, trip));
  const groups = groupDriverTrips(visibleTrips, today), current = groups.running.find(x => x.truckId === truckId);
  const next = groups.ready.find(x => x.truckId === truckId) ?? groups.upcoming.find(x => x.truckId === truckId);
  const href = (x: DriverTripSummary) => embedded ? `/driver?v=${encodeURIComponent(truckId ?? "")}&trip=${encodeURIComponent(x.id)}#trip-paperwork` : `/driver/trips/${encodeURIComponent(x.id)}`;
  const tr = (s: string) => tri(loc, s);
  const plate = (x: DriverTripSummary) => trucks.find(v => v.id === x.truckId)?.name;
  const when = (x: DriverTripSummary) => { const at = x.loadedAt && Number.isFinite(Date.parse(x.loadedAt)) ? new Date(x.loadedAt).toLocaleTimeString(loc === "en" ? "en-GB" : loc, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }) : null; return [fmtDate(loc, x.date, true), at].filter(Boolean).join(" · "); };
  const ICON: Record<CheckState, string> = { done: "✓", todo: "!", missing: "!", later: "·" };
  const checklist = (x: DriverTripSummary) => {
    const items = tripChecklist(x, docs[x.id], today);
    if (!items.length) return null;
    const missing = items.filter(c => c.state === "missing" && DOC_KEYS.includes(c.key));
    return <>
      <ul className="dchk" aria-label={tr("Ce ai de făcut|To do|Do zrobienia")}>{items.map(c => <li key={c.key} className={`dchk-i s-${c.state}`}><i aria-hidden="true">{ICON[c.state]}</i><span>{tr(CHECK_LABEL[c.key])}</span><span className="sr-only">{tr(c.state === "done" ? "gata|done|gotowe" : c.state === "missing" ? "lipsește|missing|brak" : c.state === "todo" ? "de făcut|to do|do zrobienia" : "mai târziu|later|później")}</span></li>)}</ul>
      {missing.length ? <div className="dchk-acts">{missing.map(c => <Link key={c.key} className="btn dact" href={`${href(x).replace(/#.*$/, "")}#pw-${c.key}`}><span aria-hidden="true">📷</span>{tr(CHECK_ACTION[c.key]!)}</Link>)}</div> : null}
    </>;
  };
  const card = (x: DriverTripSummary) => {
    const stage = driverTripStage(x, today);
    return <article key={x.id} className={`driver-trip-card stage-${stage}${x.id === selectedId ? " selected" : ""}`}>
      <Link className="dtc-link" href={href(x)} aria-current={x.id === selectedId ? "true" : undefined}>
        <div className="driver-trip-meta"><span>{when(x)}</span><span className={`badge ${stage === "documents" ? "warn" : stage === "running" ? "ok" : ""}`}>{tr(stage === "finished" && x.deliveredAt && x.podReceived ? "Livrată · POD trimis|Delivered · POD sent|Dostarczony · POD wysłany" : labels[stage])}</span></div>
        {pendingIds.has(x.id) && <span className="driver-trip-warning">{tr("Salvat pe telefon · se trimite|Saved on phone · sending|Zapisane w telefonie · wysyłanie")}</span>}
        <TripRoute title={x.title} loc={loc} /><span className="driver-trip-assignment">{[plate(x), x.client].filter(value => value && value !== "—").join(" · ")}</span>
        {stage === "ready" && x.date < today ? <span className="driver-trip-warning">{tr("Data a trecut · întreabă patronul|Date passed · ask the owner|Termin minął · zapytaj właściciela")}</span> : null}
        {!x.cancelledAt && !x.deliveredAt && x.planned && x.truckId !== truckId ? <span className="driver-trip-warning">{tr("Alt camion · întreabă patronul|Different truck · ask the owner|Inny pojazd · zapytaj właściciela")}</span> : null}
        {x.cancelledAt && x.cancelReason ? <span className="sub">{x.cancelReason}</span> : null}
      </Link>
      {checklist(x)}
    </article>;
  };
  const status = !queueReady ? <p role="status" className="sub">{tr(queueError ? "Operațiunile locale nu pot fi citite. Reîncarcă pagina înainte de a continua.|Local actions could not be read. Reload before continuing.|Nie można odczytać operacji lokalnych. Odśwież stronę przed kontynuowaniem." : "Verificăm operațiunile salvate pe telefon…|Checking actions saved on this device…|Sprawdzanie operacji zapisanych na urządzeniu…")}</p> : null;
  const currentBox = <div className={`driver-current${current ? " active" : ""}`}>
    {status ?? <>
      <p className="eyebrow">{tr(current ? "Cursa de acum|Current trip|Bieżący kurs" : next ? "Următoarea cursă|Next trip|Następny kurs" : "Nicio cursă acum|No trip now|Brak kursu")}</p>
      {current ? <><TripRoute title={current.title} loc={loc} /><div className="driver-trip-meta">{when(current)} · {plate(current)}</div>{checklist(current)}<Link className="btn pri" href={href(current)}>{tr(pendingIds.has(current.id) ? "Verifică sincronizarea cursei|Check trip sync|Sprawdź synchronizację kursu" : "Continuă cursa|Continue trip|Kontynuuj kurs")}</Link></>
        : next ? <><TripRoute title={next.title} loc={loc} /><div className="driver-trip-meta">{when(next)} · {plate(next)}</div>{checklist(next)}<Link className="btn sec" href={href(next)}>{tr("Vezi cursa|View trip|Zobacz kurs")}</Link></>
        : <p>{tr("Patronul nu ți-a dat alte curse.|No more trips assigned.|Brak kolejnych kursów.")}</p>}
      {groups.running.length > 1 ? <p className="driver-trip-warning">{tr("Mai multe curse încărcate · întreabă patronul|Several trips loaded · ask the owner|Kilka kursów załadowanych · zapytaj właściciela")}</p> : null}
    </>}
  </div>;
  const s = driverSections(visibleTrips, today);
  const nowRows = s.now.filter(x => x.id !== current?.id);
  const counts = [nowRows.length + (current ? 1 : 0), s.next.length, s.done.length];
  const [seg, setSeg] = useState(() => counts[0] ? 0 : counts[1] ? 1 : counts[2] ? 2 : 0);
  const tabsRef = useRef<HTMLDivElement>(null), scrollY = useRef<number[]>([0, 0, 0]), from = useRef<number | null>(null), swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const [dir, setDir] = useState<"l" | "r" | "">("");
  // back from a trip within 30 min → same segment
  useEffect(() => {
    if (variant === "home") return;
    let v: { i: number; at: number } | null = null;
    try { v = JSON.parse(sessionStorage.getItem(SEG_KEY) ?? "null"); } catch {}
    if (!v || !(v.i >= 0 && v.i < 3) || Date.now() - v.at > 30 * 60_000) return;
    const i = v.i, raf = requestAnimationFrame(() => setSeg(i));
    return () => cancelAnimationFrame(raf);
  }, [variant]);
  const pick = (i: number) => {
    if (i === seg || i < 0 || i > 2) return;
    scrollY.current[seg] = window.scrollY; from.current = seg; setDir(i > seg ? "l" : "r"); setSeg(i);
    try { sessionStorage.setItem(SEG_KEY, JSON.stringify({ i, at: Date.now() })); } catch {}
  };
  // each segment keeps its own scroll spot once the control is pinned
  useLayoutEffect(() => {
    if (from.current == null || !tabsRef.current) return;
    from.current = null;
    const pin = tabsRef.current.getBoundingClientRect().top + window.scrollY - 8;
    if (window.scrollY > pin) window.scrollTo({ top: Math.max(pin, scrollY.current[seg]), behavior: "instant" as ScrollBehavior });
  }, [seg]);
  if (variant === "home") return <section className="driver-trips home" aria-label={tr("Cursa ta|Your trip|Twój kurs")}>{currentBox}</section>;
  const empty = (icon: string, title: string, sub: string, extra?: ReactNode) => <div className="dseg-empty"><span className="dseg-empty-ic" aria-hidden="true">{icon}</span><strong>{tr(title)}</strong><p>{tr(sub)}</p>{extra}</div>;
  const panels: { key: string; label: string; body: ReactNode }[] = [
    { key: "now", label: "Acum|Now|Teraz", body: current || status || nowRows.length ? <>
      {current || status ? currentBox : null}
      {nowRows.length ? <div className="driver-trip-list">{nowRows.map(card)}</div> : null}
    </> : empty("⏸", "Nicio cursă acum|No trip right now|Brak kursu teraz", "Când patronul îți dă o cursă, o vezi aici.|When the owner assigns a trip, it shows up here.|Gdy właściciel przydzieli kurs, zobaczysz go tutaj.",
      s.next.length ? <button type="button" className="btn sec" onClick={() => pick(1)}>{tr("Vezi următoarele|See upcoming|Zobacz nadchodzące")} ({s.next.length})</button> : null) },
    { key: "next", label: "Următoarele|Upcoming|Nadchodzące", body: s.next.length ? <div className="driver-trip-list">{s.next.map(card)}</div>
      : empty("🗓", "Nicio cursă planificată|No trips planned|Brak zaplanowanych kursów", "Cursele noi apar aici imediat ce sunt alocate.|New trips appear here as soon as they are assigned.|Nowe kursy pojawią się tu od razu po przydzieleniu.") },
    { key: "done", label: "Terminate|Finished|Zakończone", body: <>
      <h2 className="dsec-h dseg-sub">{tr("Terminate · 30 zile|Finished · 30 days|Zakończone · 30 dni")}</h2>
      {s.oldMissing.length ? <p className="driver-trip-old"><Link className="link" href="/driver/docs">{countTri(loc, s.oldMissing.length, "cursă mai veche/curse mai vechi/de curse mai vechi|older trip/older trips|starszy kurs/starsze kursy/starszych kursów")} {tr("fără POD → Acte|without POD → Documents|bez POD → Dokumenty")}</Link></p> : null}
      {s.done.length ? <div className="driver-trip-list">{s.done.map(card)}</div>
        : empty("✓", "Nicio cursă terminată|No finished trips|Brak zakończonych kursów", "Cursele livrate în ultimele 30 de zile apar aici.|Trips delivered in the last 30 days appear here.|Kursy dostarczone w ostatnich 30 dniach pojawią się tutaj.")}
      {s.cancelled.length ? <details className="driver-trip-group"><summary>{tr("Anulate|Cancelled|Anulowane")} · {s.cancelled.length}</summary><div className="driver-trip-list">{s.cancelled.map(card)}</div></details> : null}
    </> },
  ];
  const key = (e: KeyboardEvent) => {
    const i = e.key === "ArrowRight" ? seg + 1 : e.key === "ArrowLeft" ? seg - 1 : e.key === "Home" ? 0 : e.key === "End" ? 2 : -1;
    if (i < 0 || i > 2) return;
    e.preventDefault(); pick(i); tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[i]?.focus();
  };
  const touchStart = (e: TouchEvent) => { const t = e.touches[0]; swipe.current = e.touches.length === 1 && !(e.target as HTMLElement).closest("input,textarea,select,[data-noswipe]") ? { x: t.clientX, y: t.clientY, t: Date.now() } : null; };
  const touchEnd = (e: TouchEvent) => {
    const a = swipe.current, t = e.changedTouches[0]; swipe.current = null;
    if (!a || !t) return;
    const dx = t.clientX - a.x, dy = t.clientY - a.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - a.t < 700) pick(seg + (dx < 0 ? 1 : -1));
  };
  return <div className="driver-trips full">
    <div className="dsegc" ref={tabsRef} role="tablist" aria-label={tr("Cursele mele|My trips|Moje kursy")} onKeyDown={key} style={{ ["--i" as string]: seg }}>
      <span className="dsegc-thumb" aria-hidden="true" />
      {panels.map((p, i) => <button key={p.key} type="button" role="tab" id={`dseg-${p.key}`} aria-selected={i === seg} aria-controls={`dpanel-${p.key}`} tabIndex={i === seg ? 0 : -1} className={i === seg ? "on" : undefined} onClick={() => pick(i)}>
        <span className="dsegc-l">{tr(p.label)}</span><b className="dsegc-n">{counts[i]}</b>
      </button>)}
    </div>
    {queueError && seg !== 0 ? status : null}
    <div className="dseg-panels" onTouchStart={touchStart} onTouchEnd={touchEnd}>
      {panels.map((p, i) => <section key={p.key} role="tabpanel" id={`dpanel-${p.key}`} aria-labelledby={`dseg-${p.key}`} hidden={i !== seg} className={`dseg-panel${i === seg && dir ? ` in-${dir}` : ""}`}>{p.body}</section>)}
    </div>
  </div>;
}
