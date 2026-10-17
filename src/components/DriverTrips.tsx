"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { tri, fmtDate, type Locale } from "@/lib/i18n";
import { groupDriverTrips, driverTripStage, type DriverTripSummary, type DriverTripStage } from "@/lib/driver-trips";
const labels: Record<DriverTripStage, string> = {
  running: "Încărcată · în desfășurare|Loaded · in progress|Załadowany · w trakcie",
  ready: "De încărcat|Ready for loading|Do załadunku",
  upcoming: "Planificată|Scheduled|Zaplanowany",
  documents: "Livrată · lipsește POD|Delivered · POD needed|Dostarczony · brakuje POD",
  finished: "Încheiată|Completed|Zakończony",
  cancelled: "Anulată|Cancelled|Anulowany",
};
export function DriverTrips({ trips, today, truckId, trucks, loc, selectedId, embedded = false }: { trips: DriverTripSummary[]; today: string; truckId?: string | null; trucks: { id: string; name: string }[]; loc: Locale; selectedId?: string; embedded?: boolean }) {
  const selected = trips.find(x => x.id === selectedId);
  const selectedStage = selected ? driverTripStage(selected, today) : null;
  const selectedView = selectedStage === "upcoming" ? "next" : selectedStage === "documents" || selectedStage === "finished" || selectedStage === "cancelled" ? "history" : "now";
  const [view, setView] = useState<"now" | "next" | "history">(selectedView);
  useEffect(() => { setView(selectedView); }, [selectedId, selectedView]);
  const groups = groupDriverTrips(trips, today), current = groups.running.find(x => x.truckId === truckId) ?? groups.running[0];
  const next = groups.ready[0] ?? groups.upcoming[0];
  const href = (x: DriverTripSummary) => embedded ? `/driver?v=${encodeURIComponent(truckId ?? "")}&trip=${encodeURIComponent(x.id)}#trip-paperwork` : `/driver/trips/${encodeURIComponent(x.id)}`;
  const tr = (s: string) => tri(loc, s);
  const counts = { now: groups.running.length + groups.ready.length, next: groups.upcoming.length, history: groups.documents.length + groups.finished.length };
  const card = (x: DriverTripSummary) => {
    const stage = driverTripStage(x, today);
    return <Link key={x.id} className={`driver-trip-card${x.id === selectedId ? " selected" : ""}`} href={href(x)} aria-current={x.id === selectedId ? "true" : undefined}>
      <div className="driver-trip-meta"><span>{fmtDate(loc, x.date, true)}</span><span className={`badge ${stage === "documents" ? "warn" : stage === "running" ? "ok" : ""}`}>{tr(stage === "finished" && x.deliveredAt && x.podReceived ? "Livrată · POD trimis|Delivered · POD sent|Dostarczony · POD wysłany" : labels[stage])}</span></div>
      <strong>{x.title}</strong><span className="sub">{[trucks.find(v => v.id === x.truckId)?.name, x.client].filter(value => value && value !== "—").join(" · ")}</span>
      {stage === "ready" && x.date < today ? <span className="driver-trip-warning">{tr("Data planificată a trecut · verifică cu patronul|Scheduled date passed · check with the owner|Termin minął · sprawdź z właścicielem")}</span> : null}
      {!x.cancelledAt && !x.deliveredAt && x.planned && x.truckId !== truckId ? <span className="driver-trip-warning">{tr("Camion diferit de cel alocat · contactează patronul|Different truck assigned · contact the owner|Inny przypisany pojazd · skontaktuj się z właścicielem")}</span> : null}
      {x.cancelledAt && x.cancelReason ? <span className="sub">{x.cancelReason}</span> : null}
      <span className="driver-trip-open">{tr(x.id === selectedId ? "Deschisă mai jos ↓|Open below ↓|Otwarty poniżej ↓" : stage === "documents" ? "Trimite POD →|Send POD →|Wyślij POD →" : "Vezi cursa →|View trip →|Zobacz kurs →")}</span>
    </Link>;
  };
  const rows = view === "now" ? [...groups.running, ...groups.ready] : view === "next" ? groups.upcoming : [...groups.documents, ...groups.finished];
  return <section className="driver-trips" aria-labelledby="my-trips-title">
    <h2 className="h2" id="my-trips-title">{tr("Cursele mele|My trips|Moje kursy")}</h2>
    <div className={`driver-current${current ? " active" : ""}`}>
      <p className="eyebrow">{tr(current ? "Cursa în desfășurare|Current trip|Bieżący kurs" : "Nicio cursă în desfășurare|No trip in progress|Brak kursu w trakcie")}</p>
      {current ? <><h3>{current.title}</h3><p>{tr("Marfă încărcată · așteaptă descărcarea|Cargo loaded · awaiting unloading|Ładunek załadowany · oczekuje na rozładunek")}</p><div className="driver-trip-meta">{fmtDate(loc, current.date, true)} · {trucks.find(v => v.id === current.truckId)?.name}</div><Link className="btn pri" href={href(current)}>{tr("Continuă cursa|Continue trip|Kontynuuj kurs")}</Link></> : <><p>{next ? `${tr("Următoarea cursă|Next trip|Następny kurs")}: ${next.title} · ${fmtDate(loc, next.date, true)}` : tr("Patronul nu ți-a atribuit alte curse.|The owner has not assigned any more trips.|Właściciel nie przypisał kolejnych kursów.")}</p>{next ? <Link className="btn sec" href={href(next)}>{tr("Vezi următoarea cursă|View next trip|Zobacz następny kurs")}</Link> : null}</>}
      {groups.running.length > 1 ? <p className="driver-trip-warning">{tr("Ai mai multe curse marcate încărcate. Verifică situația cu patronul.|Multiple trips are marked loaded. Check with the owner.|Kilka kursów oznaczono jako załadowane. Sprawdź z właścicielem.")}</p> : null}
    </div>
    {groups.documents.length ? <button className="driver-pod-reminder" onClick={() => setView("history")}>{groups.documents.length}{" "}{tr(groups.documents.length === 1 ? "livrare fără POD · vezi documentele →|delivery missing POD · view documents →|dostawa bez POD · zobacz dokumenty →" : "livrări fără POD · vezi documentele →|deliveries missing POD · view documents →|dostaw bez POD · zobacz dokumenty →")}</button> : null}
    <div className="driver-trip-tabs" role="group" aria-label={tr("Alege lista de curse|Choose trip list|Wybierz listę kursów")}>{(["now", "next", "history"] as const).map(key => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}><span>{tr(key === "now" ? "Acum|Now|Teraz" : key === "next" ? "Urmează|Upcoming|Nadchodzące" : "Livrate|Delivered|Dostarczone")}</span><b>{counts[key]}</b></button>)}</div>
    <p className="driver-trip-explanation">{tr(view === "now" ? "Cursele începute și cele de încărcat azi sau restante.|Started trips and loads due today or overdue.|Rozpoczęte kursy i załadunki na dziś lub zaległe." : view === "next" ? "Curse planificate pentru zilele următoare, încă neîncepute.|Trips scheduled for upcoming days, not yet started.|Kursy zaplanowane na kolejne dni, jeszcze nierozpoczęte." : "Livrările tale. Cele fără dovada livrării apar primele.|Your deliveries. Missing delivery proof appears first.|Twoje dostawy. Najpierw te bez potwierdzenia.")}</p>
    <div className="driver-trip-list">{rows.map(card)}</div>
    {!rows.length ? <p className="driver-trip-empty">{tr(view === "now" ? "Nu ai curse de făcut acum.|No trips to handle now.|Brak kursów do realizacji teraz." : view === "next" ? "Nu ai încă alte curse planificate.|No upcoming trips assigned yet.|Nie przypisano jeszcze kolejnych kursów." : "Nu ai încă livrări înregistrate.|No deliveries recorded yet.|Nie zapisano jeszcze dostaw.")}</p> : null}
    {view === "history" && groups.cancelled.length ? <details className="driver-trip-group"><summary>{tr("Anulate|Cancelled|Anulowane")} · {groups.cancelled.length}</summary><div className="driver-trip-list">{groups.cancelled.map(card)}</div></details> : null}
  </section>;
}
