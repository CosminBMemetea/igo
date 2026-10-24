"use client";
import Link from "next/link";
import { outboxItems, type OutboxItem } from "@/lib/outbox";
import { applyDriverTripUpdate, DRIVER_TRIP_UPDATE, type DriverTripUpdate } from "@/lib/driver-trip-update";
import { useEffect, useState, type ReactNode } from "react";
import { countTri, tri, fmtDate, type Locale } from "@/lib/i18n";
import { groupDriverTrips, driverTripStage, type DriverTripSummary, type DriverTripStage } from "@/lib/driver-trips";
import { tripChecklist, driverSections, CHECK_LABEL, CHECK_ACTION, DOC_KEYS, type TripDocs, type CheckState } from "@/lib/driver-checklist";
function TripRoute({ title, loc }: { title: string; loc: Locale }) {
  const stops = title.split(/\s+(?:→|·|–|—)\s+/);
  if (stops.length < 2) return <strong className="driver-route-title">{title}</strong>;
  return <div className="driver-route">{stops.map((stop, i) => <div className="driver-route-stop" key={i}><span className="driver-route-dot" aria-hidden="true" /><div><small>{tri(loc, i === 0 ? "Plecare|From|Wyjazd" : i === stops.length - 1 ? "Destinație|To|Cel" : "Pe traseu|Via|Przez")}</small><strong>{stop}</strong></div></div>)}</div>;
}
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
  if (variant === "home") return <section className="driver-trips home" aria-label={tr("Cursa ta|Your trip|Twój kurs")}>{currentBox}</section>;
  const s = driverSections(visibleTrips, today);
  const nowRows = s.now.filter(x => x.id !== current?.id);
  const block = (id: string, title: string, rows: DriverTripSummary[], empty: string, extra?: ReactNode) => <section className="dsec" aria-labelledby={id}>
    <h2 className="dsec-h" id={id}><span>{tr(title)}</span><b>{rows.length + (id === "sec-now" && current ? 1 : 0)}</b></h2>
    {extra}
    {rows.length ? <div className="driver-trip-list">{rows.map(card)}</div> : extra ? null : <p className="driver-trip-empty">{tr(empty)}</p>}
  </section>;
  return <div className="driver-trips full">
    {block("sec-now", "Acum|Now|Teraz", nowRows, "Nimic de făcut acum.|Nothing to do now.|Nic do zrobienia teraz.", current || status ? currentBox : undefined)}
    {block("sec-next", "Următoarele|Upcoming|Nadchodzące", s.next, "Nicio cursă planificată.|No trips planned.|Brak zaplanowanych kursów.")}
    {block("sec-done", "Terminate · 30 zile|Finished · 30 days|Zakończone · 30 dni", s.done, "Nicio cursă terminată.|No finished trips.|Brak zakończonych kursów.", s.oldMissing.length ? <p className="driver-trip-old"><Link className="link" href="/driver/docs">{countTri(loc, s.oldMissing.length, "cursă mai veche/curse mai vechi/de curse mai vechi|older trip/older trips|starszy kurs/starsze kursy/starszych kursów")} {tr("fără POD → Acte|without POD → Documents|bez POD → Dokumenty")}</Link></p> : undefined)}
    {s.cancelled.length ? <details className="driver-trip-group"><summary>{tr("Anulate|Cancelled|Anulowane")} · {s.cancelled.length}</summary><div className="driver-trip-list">{s.cancelled.map(card)}</div></details> : null}
  </div>;
}
