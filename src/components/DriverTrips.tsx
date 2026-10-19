"use client";
import Link from "next/link";
import { outboxItems, type OutboxItem } from "@/lib/outbox";
import { applyDriverTripUpdate, DRIVER_TRIP_UPDATE, type DriverTripUpdate } from "@/lib/driver-trip-update";
import { useEffect, useState } from "react";
import { tri, fmtDate, type Locale } from "@/lib/i18n";
import { groupDriverTrips, driverTripStage, type DriverTripSummary, type DriverTripStage } from "@/lib/driver-trips";
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
export function DriverTrips({ trips, today, truckId, trucks, loc, selectedId, embedded = false, demo = false, queueScope }: { queueScope?: string; trips: DriverTripSummary[]; today: string; truckId?: string | null; trucks: { id: string; name: string }[]; loc: Locale; selectedId?: string; embedded?: boolean; demo?: boolean }) {
  const [queued, setQueued] = useState<OutboxItem[]>([]);
  useEffect(() => {
    if (!queueScope || demo) return;
    let alive = true;
    const read = () => { void outboxItems(queueScope).then(items => { if (alive) setQueued(items); }).catch(() => {}); };
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
  const visibleTrips = trips.map(trip => (demo ? updates : [...updates, ...queued.filter(x => x.status === "pending" && x.kind === "event" && !queued.some(b => b.status === "blocked" && (b.payload as Record<string, string>).tripId === (x.payload as Record<string, string>).tripId)).map(x => ({ tripId: (x.payload as Record<string, string>).tripId, kind: (x.payload as Record<string, string>).kind, at: (x.payload as Record<string, string>).occurredAt })).filter(x => x.kind === "loaded" || x.kind === "unloaded")] as DriverTripUpdate[]).reduce(applyDriverTripUpdate, trip));
  const selected = visibleTrips.find(x => x.id === selectedId);
  const selectedStage = selected ? driverTripStage(selected, today) : null;
  const selectedView = selectedStage === "upcoming" ? "next" : selectedStage === "documents" || selectedStage === "finished" || selectedStage === "cancelled" ? "history" : "now";
  const [view, setView] = useState<"now" | "next" | "history">(selectedView);
  useEffect(() => { setView(selectedView); }, [selectedId, selectedView]);
  const groups = groupDriverTrips(visibleTrips, today), current = groups.running.find(x => x.truckId === truckId);
  const next = groups.ready.find(x => x.truckId === truckId) ?? groups.upcoming.find(x => x.truckId === truckId);
  const href = (x: DriverTripSummary) => embedded ? `/driver?v=${encodeURIComponent(truckId ?? "")}&trip=${encodeURIComponent(x.id)}#trip-paperwork` : `/driver/trips/${encodeURIComponent(x.id)}`;
  const tr = (s: string) => tri(loc, s);
  const counts = { now: groups.running.length + groups.ready.length, next: groups.upcoming.length, history: groups.documents.length + groups.finished.length };
  const card = (x: DriverTripSummary) => {
    const stage = driverTripStage(x, today);
    return <Link key={x.id} className={`driver-trip-card stage-${stage}${x.id === selectedId ? " selected" : ""}`} href={href(x)} aria-current={x.id === selectedId ? "true" : undefined}>
      <div className="driver-trip-meta"><span>{fmtDate(loc, x.date, true)}</span><span className={`badge ${stage === "documents" ? "warn" : stage === "running" ? "ok" : ""}`}>{tr(stage === "finished" && x.deliveredAt && x.podReceived ? "Livrată · POD trimis|Delivered · POD sent|Dostarczony · POD wysłany" : labels[stage])}</span></div>
      {pendingIds.has(x.id) && <span className="driver-trip-warning">{tr("Operațiuni locale · așteaptă confirmarea firmei|Local actions · awaiting company confirmation|Operacje lokalne · oczekują na potwierdzenie")}</span>}
      <TripRoute title={x.title} loc={loc} /><span className="driver-trip-assignment">{[trucks.find(v => v.id === x.truckId)?.name, x.client].filter(value => value && value !== "—").join(" · ")}</span>
      {stage === "ready" && x.date < today ? <span className="driver-trip-warning">{tr("Data planificată a trecut · verifică cu patronul|Scheduled date passed · check with the owner|Termin minął · sprawdź z właścicielem")}</span> : null}
      {!x.cancelledAt && !x.deliveredAt && x.planned && x.truckId !== truckId ? <span className="driver-trip-warning">{tr("Camion diferit de cel alocat · contactează patronul|Different truck assigned · contact the owner|Inny przypisany pojazd · skontaktuj się z właścicielem")}</span> : null}
      {x.cancelledAt && x.cancelReason ? <span className="sub">{x.cancelReason}</span> : null}
      <span className="driver-trip-open">{tr(x.id === selectedId ? "Deschisă mai jos ↓|Open below ↓|Otwarty poniżej ↓" : stage === "documents" ? "Trimite POD →|Send POD →|Wyślij POD →" : "Vezi cursa →|View trip →|Zobacz kurs →")}</span>
    </Link>;
  };
  const rows = view === "now" ? [...groups.running, ...groups.ready].filter(x => x.id !== current?.id) : view === "next" ? groups.upcoming : [...groups.documents, ...groups.finished];
  return <section className="driver-trips" aria-labelledby="my-trips-title">
    <h2 className="h2" id="my-trips-title">{tr("Cursele mele|My trips|Moje kursy")}</h2>
    <div className={`driver-current${current ? " active" : ""}`}>
      <p className="eyebrow">{tr(current ? "Cursa în desfășurare|Current trip|Bieżący kurs" : "Nicio cursă în desfășurare|No trip in progress|Brak kursu w trakcie")}</p>
      {current ? <><TripRoute title={current.title} loc={loc} /><p>{tr("Marfă încărcată · așteaptă descărcarea|Cargo loaded · awaiting unloading|Ładunek załadowany · oczekuje na rozładunek")}</p><div className="driver-trip-meta">{fmtDate(loc, current.date, true)} · {trucks.find(v => v.id === current.truckId)?.name}</div><Link className="btn pri" href={href(current)}>{tr(pendingIds.has(current.id) ? "Verifică sincronizarea cursei|Check trip sync|Sprawdź synchronizację kursu" : "Continuă cursa|Continue trip|Kontynuuj kurs")}</Link></> : <><p>{next ? `${tr("Următoarea cursă|Next trip|Następny kurs")}: ${next.title} · ${fmtDate(loc, next.date, true)}` : tr("Patronul nu ți-a atribuit alte curse.|The owner has not assigned any more trips.|Właściciel nie przypisał kolejnych kursów.")}</p>{next ? <Link className="btn sec" href={href(next)}>{tr("Vezi următoarea cursă|View next trip|Zobacz następny kurs")}</Link> : null}</>}
      {groups.running.length > 1 ? <p className="driver-trip-warning">{tr("Ai mai multe curse marcate încărcate. Verifică situația cu patronul.|Multiple trips are marked loaded. Check with the owner.|Kilka kursów oznaczono jako załadowane. Sprawdź z właścicielem.")}</p> : null}
    </div>
    {groups.documents.length ? <button className="driver-pod-reminder" onClick={() => setView("history")}>{groups.documents.length}{" "}{tr(groups.documents.length === 1 ? "livrare fără POD · vezi documentele →|delivery missing POD · view documents →|dostawa bez POD · zobacz dokumenty →" : "livrări fără POD · vezi documentele →|deliveries missing POD · view documents →|dostaw bez POD · zobacz dokumenty →")}</button> : null}
    <div className="driver-trip-tabs" role="group" aria-label={tr("Alege lista de curse|Choose trip list|Wybierz listę kursów")}>{(["now", "next", "history"] as const).map(key => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}><span>{tr(key === "now" ? "Acum|Now|Teraz" : key === "next" ? "Urmează|Upcoming|Nadchodzące" : "Livrate|Delivered|Dostarczone")}</span><b>{counts[key]}</b></button>)}</div>
    <p className="driver-trip-explanation">{tr(view === "now" ? "Cursele începute și cele de încărcat azi sau restante.|Started trips and loads due today or overdue.|Rozpoczęte kursy i załadunki na dziś lub zaległe." : view === "next" ? "Curse planificate pentru zilele următoare, încă neîncepute.|Trips scheduled for upcoming days, not yet started.|Kursy zaplanowane na kolejne dni, jeszcze nierozpoczęte." : "Livrările tale. Cele fără dovada livrării apar primele.|Your deliveries. Missing delivery proof appears first.|Twoje dostawy. Najpierw te bez potwierdzenia.")}</p>
    <div className="driver-trip-list">{rows.map(card)}</div>
    {!rows.length && !(view === "now" && current) ? <p className="driver-trip-empty">{tr(view === "now" ? "Nu ai curse de făcut acum.|No trips to handle now.|Brak kursów do realizacji teraz." : view === "next" ? "Nu ai încă alte curse planificate.|No upcoming trips assigned yet.|Nie przypisano jeszcze kolejnych kursów." : "Nu ai încă livrări înregistrate.|No deliveries recorded yet.|Nie zapisano jeszcze dostaw.")}</p> : null}
    {view === "history" && groups.cancelled.length ? <details className="driver-trip-group"><summary>{tr("Anulate|Cancelled|Anulowane")} · {groups.cancelled.length}</summary><div className="driver-trip-list">{groups.cancelled.map(card)}</div></details> : null}
  </section>;
}
