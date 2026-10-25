// The four driver tabs, ported from the web /driver, /driver/trips, /driver/docs and /driver/profile screens.
import { Linking, Pressable, StyleSheet, View } from "react-native";
import type { Board, Trip } from "../board";
import type { WorkEntry, EventKind } from "../work-queue";
import type { GPSStatus } from "../tracking";
import { C, mix } from "../theme";
import { countTri, fmtDate, fmtDateTime, fmtTime, LOCS, useT, type Loc } from "../i18n";
import { CHECK_ACTION, CHECK_LABEL, DOC_KEYS, STAGE_LABEL, driverSections, stageOf, tripChecklist, type MissingDoc, type TripDocs } from "../checklist";
import { Badge, Btn, Card, Chips, Icon, Note, Section, T, TripRoute } from "./kit";

export type Ctx = {
  board: Board; entries: WorkEntry[]; today: string; docs: Record<string, TripDocs>; missing: MissingDoc[];
  busy: boolean; canWork: boolean; blockedTrips: string[]; locked: boolean;
  onEvent: (trip: Trip, kind: EventKind) => void; onDocument: (trip: Trip, kind: "cmr" | "pod") => void; openTrip: (id: string) => void; goDocs: () => void;
};
const plateOf = (c: Ctx, t: Trip) => c.board.plates?.[t.truckId] ?? (t.truckId === c.board.truck?.id ? c.board.truck?.plate : undefined);
function when(loc: Loc, t: Trip) { return [fmtDate(loc, t.date), t.loadedAt ? fmtTime(loc, t.loadedAt) : ""].filter(Boolean).join(" · "); }
function focus(c: Ctx) {
  const g = c.board.trips, truckId = c.board.truck?.id;
  const current = (g.running ?? []).find(x => x.truckId === truckId);
  const next = (g.ready ?? []).find(x => x.truckId === truckId) ?? (g.upcoming ?? []).find(x => x.truckId === truckId);
  return { current, next };
}
export function PageTitle({ children }: { children: string }) { return <T w="semi" style={{ fontSize: 30, lineHeight: 36, marginTop: 4 }}>{children}</T>; }

function DocActions({ c, trip }: { c: Ctx; trip: Trip }) {
  const { t } = useT();
  const missing = tripChecklist(trip, c.docs[trip.id], c.today).filter(x => x.state === "missing" && DOC_KEYS.includes(x.key));
  if (!missing.length) return null;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{missing.map(x =>
    <Btn key={x.key} kind="doc" icon="📷" disabled={c.busy} label={t(CHECK_ACTION[x.key]!)} onPress={() => c.onDocument(trip, x.key as "cmr" | "pod")} style={{ minHeight: 48 }} />)}</View>;
}
/** Web .driver-current: the trip to do now, or the next one. */
export function CurrentBox({ c }: { c: Ctx }) {
  const { t, loc } = useT();
  const { current, next } = focus(c), trip = current ?? next;
  const active = !!current;
  return <View style={[st.current, active && { borderColor: mix(C.pos, 55, C.bg2), backgroundColor: mix(C.pos, 9, C.bg2) }]}>
    <T w="semi" style={{ color: active ? C.pos : C.fg2, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>{t(current ? "Cursa de acum|Current trip|Bieżący kurs" : next ? "Următoarea cursă|Next trip|Następny kurs" : "Nicio cursă acum|No trip now|Brak kursu")}</T>
    {trip ? <>
      <TripRoute title={trip.title} big />
      <T style={{ color: C.fg2, fontSize: 14 }}>{[when(loc, trip), plateOf(c, trip)].filter(Boolean).join(" · ")}</T>
      {trip.localPending ? <T style={st.warn}>{t("Salvat pe telefon · se trimite|Saved on phone · sending|Zapisane w telefonie · wysyłanie")}</T> : null}
      <Chips items={tripChecklist(trip, c.docs[trip.id], c.today)} />
      <DocActions c={c} trip={trip} />
      <Btn kind={active ? "pri" : "sec"} label={t(active ? "Continuă cursa|Continue trip|Kontynuuj kurs" : "Vezi cursa|View trip|Zobacz kurs")} onPress={() => c.openTrip(trip.id)} style={{ alignSelf: "stretch" }} />
    </> : <T style={{ color: C.fg2 }}>{t("Patronul nu ți-a dat alte curse.|No more trips assigned.|Brak kolejnych kursów.")}</T>}
    {(c.board.trips.running?.length ?? 0) > 1 ? <T style={st.warn}>{t("Mai multe curse încărcate · întreabă patronul|Several trips loaded · ask the owner|Kilka kursów załadowanych · zapytaj właściciela")}</T> : null}
  </View>;
}
function TripCard({ c, trip }: { c: Ctx; trip: Trip }) {
  const { t, loc } = useT();
  const stage = stageOf(trip, c.today);
  const label = stage === "finished" && trip.deliveredAt && trip.podReceived ? "Livrată · POD trimis|Delivered · POD sent|Dostarczony · POD wysłany" : STAGE_LABEL[stage];
  return <View style={st.card}>
    <Pressable accessibilityRole="button" onPress={() => c.openTrip(trip.id)} style={{ gap: 10 }}>
      <View style={st.meta}><T style={{ color: C.fg2, fontSize: 13 }}>{when(loc, trip)}</T><Badge label={t(label)} tone={stage === "documents" ? "warn" : stage === "running" ? "ok" : ""} /></View>
      {trip.localPending ? <T style={st.warn}>{t("Salvat pe telefon · se trimite|Saved on phone · sending|Zapisane w telefonie · wysyłanie")}</T> : null}
      <TripRoute title={trip.title} />
      <T style={{ color: C.fg2, fontSize: 13 }}>{[plateOf(c, trip), trip.client].filter(v => v && v !== "—").join(" · ")}</T>
      {stage === "ready" && trip.date < c.today ? <T style={st.warn}>{t("Data a trecut · întreabă patronul|Date passed · ask the owner|Termin minął · zapytaj właściciela")}</T> : null}
      {!trip.cancelledAt && !trip.deliveredAt && trip.planned && trip.truckId !== c.board.truck?.id ? <T style={st.warn}>{t("Alt camion · întreabă patronul|Different truck · ask the owner|Inny pojazd · zapytaj właściciela")}</T> : null}
      {trip.cancelledAt && trip.cancelReason ? <T style={{ color: C.fg2, fontSize: 14 }}>{trip.cancelReason}</T> : null}
    </Pressable>
    <Chips items={tripChecklist(trip, c.docs[trip.id], c.today)} />
    <DocActions c={c} trip={trip} />
  </View>;
}
export function Home({ c, gps, gate, gpsBlocked, onActivateGPS, onStopGPS, withoutTrip, onWithoutTrip }: { c: Ctx; gps: GPSStatus | null; gate: boolean; gpsBlocked: boolean; onActivateGPS: () => void; onStopGPS: () => void; withoutTrip: boolean; onWithoutTrip: () => void }) {
  const { t, loc } = useT();
  const b = c.board, on = !!b.shift && !b.shift.end, priv = on && !!b.shift?.privateSince;
  const first = (b.name ?? "").trim().split(/\s+/)[0] ?? "";
  const lastAck = gps?.lastAck ? Date.parse(gps.lastAck) : NaN;
  const silent = gate && (!Number.isFinite(lastAck) || Date.now() - lastAck > 90000);
  const { current, next } = focus(c), hasWork = !!current || (!!next && (b.trips.ready ?? []).some(x => x.id === next.id));
  return <View>
    <T w="semi" style={{ color: C.fg2, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>{b.truck?.plate ?? t("Niciun camion alocat|No truck assigned|Brak przypisanego pojazdu")}</T>
    <PageTitle>{`${t("Bună|Hi|Cześć")}, ${first}`}</PageTitle>
    <T style={{ color: C.fg2, fontSize: 14, marginTop: 4 }}>{!on ? t("În afara turei nu se trimite nicio poziție.|Off shift: no location is sent.|Poza zmianą lokalizacja nie jest wysyłana.")
      : priv ? t("Patronul vede doar „Privat”, fără poziție.|The owner sees only “Private”, no location.|Właściciel widzi tylko „Prywatnie”, bez lokalizacji.")
      : t("Patronul vede camionul pe hartă. Privat = fără poziție.|The owner sees the truck on the map. Private = no location.|Właściciel widzi pojazd na mapie. Prywatnie = bez lokalizacji.")}</T>
    {c.missing.length ? <Pressable accessibilityRole="button" onPress={c.goDocs} style={st.banner}>
      <View style={st.bannerN}><T w="bold" style={{ color: "#fff", fontSize: 16 }}>{c.missing.length > 9 ? "9+" : c.missing.length}</T></View>
      <View style={{ flex: 1 }}><T w="semi">{t(`Ai ${c.missing.length} acte lipsă|${c.missing.length} documents missing|Brakuje dokumentów: ${c.missing.length}`)}</T>
        <T style={{ color: C.fg2, fontSize: 13 }}>{t("Atinge ca să le rezolvi|Tap to fix|Dotknij, aby uzupełnić")}</T></View>
      <T style={{ color: C.fg2, fontSize: 22 }}>›</T>
    </Pressable> : null}
    {on && !priv ? <View style={[st.gps, !gate || silent ? { borderColor: mix(C.warn, 45, C.bg2), backgroundColor: mix(C.warn, 9, C.bg2) } : null]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="pin" size={22} color={!gate || silent ? C.warn : C.pos} />
        <T w="semi" style={{ flex: 1 }}>{!gate ? t("GPS-ul nu rulează pe acest telefon|GPS is not running on this phone|GPS nie działa na tym telefonie") : silent ? t("Poziția nu este confirmată de server|Position not confirmed by server|Pozycja niepotwierdzona przez serwer") : t("GPS activ în fundal|GPS active in background|GPS aktywny w tle")}</T>
      </View>
      <T style={{ color: C.fg2, fontSize: 13 }}>{gate && Number.isFinite(lastAck) ? `${t("Ultima confirmare|Last confirmed|Ostatnie potwierdzenie")}: ${fmtDateTime(loc, gps!.lastAck!)}` : gps?.message ?? t("Activează GPS ca patronul să vadă camionul pe hartă.|Turn on GPS so the owner sees the truck on the map.|Włącz GPS, aby właściciel widział pojazd na mapie.")}</T>
      {gate ? <Btn kind="ghost" label={t("Oprește GPS|Stop GPS|Wyłącz GPS")} disabled={c.busy} onPress={onStopGPS} />
        : <Btn label={t("Activează GPS în fundal|Turn on background GPS|Włącz GPS w tle")} disabled={c.busy || gpsBlocked} onPress={onActivateGPS} />}
    </View> : null}
    {!on && b.truck && !hasWork && !withoutTrip ? <Card style={{ marginTop: 16 }}>
      <T style={{ color: C.fg2, fontSize: 14 }}>{t("Nicio cursă de pornit pe acest camion.|No trip to start on this truck.|Brak kursu do rozpoczęcia tym pojazdem.")}</T>
      <Btn kind="sec" label={t("Lucrez fără cursă alocată|Work without an assigned trip|Praca bez przypisanego kursu")} onPress={onWithoutTrip} />
    </Card> : null}
    <View style={{ marginTop: 16 }}><CurrentBox c={c} /></View>
  </View>;
}
export function Trips({ c }: { c: Ctx }) {
  const { t, loc } = useT();
  const s = driverSections(c.board, c.today), { current } = focus(c);
  const nowRows = s.now.filter(x => x.id !== current?.id);
  return <View>
    <PageTitle>{t("Cursele mele|My trips|Moje kursy")}</PageTitle>
    <Section title={t("Acum|Now|Teraz")} count={nowRows.length + (current ? 1 : 0)}>
      {current ? <CurrentBox c={c} /> : null}
      {nowRows.map(x => <TripCard key={x.id} c={c} trip={x} />)}
      {!current && !nowRows.length ? <T style={st.empty}>{t("Nimic de făcut acum.|Nothing to do now.|Nic do zrobienia teraz.")}</T> : null}
    </Section>
    <Section title={t("Următoarele|Upcoming|Nadchodzące")} count={s.next.length}>
      {s.next.length ? s.next.map(x => <TripCard key={x.id} c={c} trip={x} />) : <T style={st.empty}>{t("Nicio cursă planificată.|No trips planned.|Brak zaplanowanych kursów.")}</T>}
    </Section>
    <Section title={t("Terminate · 30 zile|Finished · 30 days|Zakończone · 30 dni")} count={s.done.length}>
      {s.oldMissing.length ? <Pressable onPress={c.goDocs} accessibilityRole="link"><T style={{ color: C.acc, fontSize: 14 }}>{`${countTri(loc, s.oldMissing.length, "cursă mai veche/curse mai vechi/de curse mai vechi|older trip/older trips|starszy kurs/starsze kursy/starszych kursów")} ${t("fără POD → Acte|without POD → Documents|bez POD → Dokumenty")}`}</T></Pressable> : null}
      {s.done.length ? s.done.map(x => <TripCard key={x.id} c={c} trip={x} />) : <T style={st.empty}>{t("Nicio cursă terminată.|No finished trips.|Brak zakończonych kursów.")}</T>}
    </Section>
    {s.cancelled.length ? <Section title={t("Anulate|Cancelled|Anulowane")} count={s.cancelled.length}>{s.cancelled.map(x => <TripCard key={x.id} c={c} trip={x} />)}</Section> : null}
  </View>;
}
export function TripDetail({ c, trip, onBack }: { c: Ctx; trip: Trip; onBack: () => void }) {
  const { t, loc } = useT();
  const stage = stageOf(trip, c.today), mine = trip.truckId === c.board.truck?.id, blocked = c.blockedTrips.includes(trip.id);
  const files = [...(c.board.paperwork ?? []).filter(f => f.tripId === trip.id).map(f => ({ id: f.id, kind: f.kind, at: f.createdAt, sent: true })),
    ...c.entries.filter(e => e.type === "file" && e.tripId === trip.id && e.status !== "confirmed").map(e => ({ id: e.id, kind: e.type === "file" ? e.kind : "cmr", at: e.createdAt, sent: false }))];
  const stepOff = c.busy || blocked || c.locked;
  return <View style={{ gap: 14 }}>
    <Pressable accessibilityRole="button" onPress={onBack} style={st.back}><Icon name="back" size={20} color={C.fg2} /><T style={{ color: C.fg2 }}>{t("Curse|Trips|Kursy")}</T></Pressable>
    <View style={st.meta}><T style={{ color: C.fg2, fontSize: 13 }}>{[when(loc, trip), plateOf(c, trip)].filter(Boolean).join(" · ")}</T><Badge label={t(STAGE_LABEL[stage])} tone={stage === "documents" ? "warn" : stage === "running" ? "ok" : ""} /></View>
    <TripRoute title={trip.title} big />
    {trip.client && trip.client !== "—" ? <T style={{ color: C.fg2 }}>{trip.client}</T> : null}
    <Chips items={tripChecklist(trip, c.docs[trip.id], c.today)} />
    {trip.localPending ? <Note>{t("Etapă salvată pe telefon · așteaptă confirmarea firmei|Step saved on phone · waiting for the company|Etap zapisany w telefonie · czeka na firmę")}</Note> : null}
    {blocked ? <Note tone="bad">{t("O operațiune necesită verificare în Acte → Pe telefon.|An action needs checking in Documents → On this phone.|Operacja wymaga sprawdzenia w Dokumenty → W telefonie.")}</Note> : null}
    {!mine && ["running", "ready", "upcoming"].includes(stage) ? <Note>{t("Alt camion decât cel alocat. Verifică împreună cu patronul.|Not your assigned truck. Check with the owner.|Inny pojazd niż przypisany. Sprawdź z właścicielem.")}</Note> : null}
    {mine && (stage === "running" || stage === "ready") ? <Card>
      {c.canWork ? <>
        <Btn style={{ alignSelf: "stretch" }} disabled={stepOff || !!trip.waitSince} label={t(stage === "running" ? "Am descărcat · confirmă livrarea|Unloaded · confirm delivery|Rozładowano · potwierdź dostawę" : "Am încărcat · confirmă încărcarea|Loaded · confirm loading|Załadowano · potwierdź załadunek")} onPress={() => c.onEvent(trip, stage === "running" ? "unloaded" : "loaded")} />
        <Btn kind="sec" style={{ alignSelf: "stretch" }} disabled={stepOff} label={t(trip.waitSince ? "Încheie așteptarea|End waiting|Zakończ oczekiwanie" : "Aștept la client|Waiting at customer|Czekam u klienta")} onPress={() => c.onEvent(trip, trip.waitSince ? "wait_end" : "wait_start")} />
        {trip.waitSince ? <T style={st.warn}>{`${t("Așteptare din|Waiting since|Oczekiwanie od")} ${fmtTime(loc, trip.waitSince)}. ${t("Încheie așteptarea înainte de următoarea etapă.|End waiting before the next step.|Zakończ oczekiwanie przed kolejnym etapem.")}`}</T> : null}
      </> : <T style={{ color: C.fg2, fontSize: 14 }}>{t("Pornește tura și ieși din Privat ca să confirmi etapa cursei.|Start your shift and leave Private to confirm the trip step.|Rozpocznij zmianę i wyłącz tryb prywatny, aby potwierdzić etap.")}</T>}
    </Card> : null}
    {stage === "documents" ? <Note>{t("Fotografiază dovada livrării (POD). Cursa se încheie după ce firma primește POD-ul.|Photograph the proof of delivery (POD). The trip closes once the company gets it.|Zrób zdjęcie POD. Kurs zamknie się, gdy firma go otrzyma.")}</Note> : null}
    {stage !== "cancelled" ? <Section title={t("Acte cursă|Trip documents|Dokumenty kursu")} count={files.length}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Btn kind={tripChecklist(trip, c.docs[trip.id], c.today).some(x => x.key === "cmr" && x.state === "missing") ? "doc" : "sec"} icon="📷" disabled={c.busy} label={t(CHECK_ACTION.cmr!)} onPress={() => c.onDocument(trip, "cmr")} />
        {stage === "documents" || stage === "finished" ? <Btn kind={stage === "documents" ? "doc" : "sec"} icon="📷" disabled={c.busy} label={t(CHECK_ACTION.pod!)} onPress={() => c.onDocument(trip, "pod")} /> : null}
      </View>
      {files.map(f => <View key={f.id} style={st.row}><T w="semi" style={{ fontSize: 14 }}>{f.kind.toUpperCase()}</T><T style={{ flex: 1, color: C.fg2, fontSize: 13 }}>{fmtDateTime(loc, f.at)}</T><Badge label={t(f.sent ? "Primit de firmă|Received|Odebrano" : "Pe telefon|On phone|W telefonie")} tone={f.sent ? "ok" : "warn"} /></View>)}
    </Section> : trip.cancelReason ? <T style={{ color: C.fg2 }}>{trip.cancelReason}</T> : null}
  </View>;
}
const VEHICLE_DOC: Record<string, string> = { rca: "RCA", itp: "ITP|Inspection (ITP)|Przegląd (ITP)", vignette: "Rovinietă|Road vignette|Winieta", tollro: "TollRo", classification: "Datele din talon|Registration data|Dane z dowodu rejestracyjnego", casco: "CASCO", tacho: "Tahograf|Tachograph|Tachograf", copy: "Copie conformă|Certified copy|Wypis z licencji", service: "Revizie|Service|Serwis" };
const DRIVER_DOC: Record<string, string> = { licence: "Permis de conducere|Driving licence|Prawo jazdy", cpc: "Atestat profesional|CPC certificate|Świadectwo kwalifikacji", tachoCard: "Card tahograf|Tachograph card|Karta kierowcy", medical: "Aviz medical și psihologic|Medical & psychological check|Badania lekarskie i psychologiczne" };
export const COMPLIANCE: Record<string, string> = { valid: "În termen · declarat|In date · declared|W terminie · deklaracja", soon: "Expiră curând|Expiring soon|Wkrótce wygasa", urgent: "Expiră în ≤ 7 zile|Expires in ≤ 7 days|Wygasa za ≤ 7 dni", expired: "Expirat|Expired|Wygasły", missing: "Lipsește din evidență|Missing from records|Brak w ewidencji", unknown: "De verificat|Needs checking|Do sprawdzenia", future: "Nu a început încă|Not yet active|Jeszcze nieważny" };
const tone = (state: string) => state === "valid" ? "ok" as const : state === "soon" || state === "unknown" || state === "future" ? "warn" as const : "bad" as const;
const STATUS: Record<WorkEntry["status"], string> = { draft: "De verificat · nu e trimis|To review · not sent|Do sprawdzenia · niewysłane", queued: "Salvat pe telefon|Saved on phone|Zapisane w telefonie", sending: "Se trimite|Sending|Wysyłanie", attention: "Necesită atenție|Needs attention|Wymaga uwagi", confirmed: "Primit de firmă|Received by the company|Odebrane przez firmę" };
const EVENT: Record<EventKind, string> = { loaded: "Încărcare|Loading|Załadunek", unloaded: "Descărcare|Unloading|Rozładunek", wait_start: "Început așteptare|Waiting started|Początek oczekiwania", wait_end: "Sfârșit așteptare|Waiting ended|Koniec oczekiwania" };
export function Docs({ c, onReview, onRetry, onDiscard, onSync, syncedAt, syncing }: { c: Ctx; onReview: (id: string) => void; onRetry: (id: string) => void; onDiscard: (id: string) => void; onSync: () => void; syncedAt: number | null; syncing: boolean }) {
  const { t, loc } = useT();
  const b = c.board, pending = c.entries.filter(e => e.status !== "confirmed");
  const titleOf = (id: string) => Object.values(b.trips).flat().find(x => x.id === id)?.title ?? t("Cursă|Trip|Kurs");
  return <View>
    <PageTitle>{t("Acte|Documents|Dokumenty")}</PageTitle>
    <Section title={t("De trimis|To send|Do wysłania")} count={c.missing.length}>
      {c.missing.length ? c.missing.map(m => <View key={`${m.trip.id}-${m.key}`} style={st.card}>
        <T w="semi">{t(CHECK_LABEL[m.key])}</T>
        <T lines={1} style={{ color: C.fg2, fontSize: 14 }}>{m.trip.title}</T>
        <T style={{ color: C.fg3, fontSize: 13 }}>{[fmtDate(loc, m.trip.date), plateOf(c, m.trip)].filter(Boolean).join(" · ")}</T>
        <Btn kind="pri" icon="📷" disabled={c.busy} label={t(CHECK_ACTION[m.key] ?? "Deschide|Open|Otwórz")} onPress={() => c.onDocument(m.trip, m.key as "cmr" | "pod")} style={{ alignSelf: "stretch" }} />
      </View>) : <View style={st.ok}><T w="bold" style={{ color: C.pos }}>✓</T><T style={{ flex: 1 }}>{t("Toate actele curselor sunt trimise.|All trip documents are sent.|Wszystkie dokumenty kursów wysłane.")}</T></View>}
    </Section>
    <Section title={t("Pe telefon|On this phone|W telefonie")} count={pending.length}>
      <View style={st.row}><Icon name="sync" size={18} color={C.fg2} /><T style={{ flex: 1, color: C.fg2, fontSize: 13 }}>{syncing ? t("Sincronizare în curs…|Syncing…|Synchronizacja…") : syncedAt ? `${t("Ultima actualizare|Last update|Ostatnia aktualizacja")}: ${fmtDateTime(loc, new Date(syncedAt).toISOString())}` : t("Prima conectare necesită internet|First sign-in needs internet|Pierwsze logowanie wymaga internetu")}</T>
        <Btn kind="ghost" label={t("Sincronizează|Sync|Synchronizuj")} disabled={syncing} onPress={onSync} style={{ minHeight: 40, paddingVertical: 6 }} /></View>
      {pending.length ? pending.map(e => <View key={e.id} style={st.card}>
        <View style={st.meta}><T w="semi" style={{ flex: 1 }}>{e.type === "event" ? t(EVENT[e.kind]) : e.kind.toUpperCase()}</T><Badge label={t(STATUS[e.status])} tone={e.status === "attention" ? "bad" : "warn"} /></View>
        <T lines={1} style={{ color: C.fg2, fontSize: 14 }}>{e.title}</T>
        <T style={{ color: C.fg3, fontSize: 13 }}>{fmtDateTime(loc, e.createdAt)}{e.type === "file" ? ` · ${Math.ceil(e.size / 1024)} KB` : ""}</T>
        {e.message ? <T style={{ color: C.fg2, fontSize: 13 }}>{e.message}</T> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {e.type === "file" ? <Btn kind="sec" label={t("Vezi fotografia|View photo|Zobacz zdjęcie")} disabled={c.busy} onPress={() => onReview(e.id)} style={st.small} /> : null}
          {e.status !== "draft" ? <Btn kind="sec" label={t("Reîncearcă|Retry|Ponów")} disabled={c.busy} onPress={() => onRetry(e.id)} style={st.small} /> : null}
          <Btn kind="ghost" label={t("Elimină local|Remove locally|Usuń lokalnie")} disabled={c.busy} onPress={() => onDiscard(e.id)} style={st.small} />
        </View>
      </View>) : <T style={st.empty}>{t("Nimic în așteptare pe acest telefon.|Nothing waiting on this phone.|Nic nie czeka w tym telefonie.")}</T>}
    </Section>
    <Section title={t("Actele mele|My documents|Moje dokumenty")}>
      {b.myDocs?.length ? b.myDocs.map(d => <View key={d.type} style={st.docRow}>
        <View style={{ flex: 1 }}><T w="medium">{DRIVER_DOC[d.type] ? t(DRIVER_DOC[d.type]) : d.type}</T><T style={{ color: C.fg2, fontSize: 13 }}>{d.expires ? `${t("expiră|expires|wygasa")} ${fmtDate(loc, d.expires)}` : "—"}</T></View>
        <Badge label={t(COMPLIANCE[d.state] ?? COMPLIANCE.unknown)} tone={tone(d.state)} />
      </View>) : <T style={st.empty}>{t("Niciun document aici.|No documents here.|Brak dokumentów.")}</T>}
    </Section>
    {b.alerts?.length ? <Section title={t("De verificat|To check|Do sprawdzenia")} count={b.alerts.length}>
      {b.alerts.map(a => <View key={a.id} style={st.docRow}><View style={{ flex: 1 }}><T w="medium">{a.label}</T><T style={{ color: C.fg2, fontSize: 13 }}>{[DRIVER_DOC[a.type] ? t(DRIVER_DOC[a.type]) : VEHICLE_DOC[a.type] ? t(VEHICLE_DOC[a.type]) : a.type, a.expires ? fmtDate(loc, a.expires) : ""].filter(Boolean).join(" · ")}</T></View>
        <Badge label={t(a.kind === "compliance-task" ? "Cerut de firmă|Requested|Na prośbę firmy" : "De verificat|To check|Do sprawdzenia")} tone="warn" /></View>)}
    </Section> : null}
    {b.truck ? <Section title={`${t("Camionul|Truck|Pojazd")} ${b.truck.plate}`}>
      {b.road ? <>
        <T style={{ color: C.fg2, fontSize: 14 }}>{[b.road.regime === "tollro" ? "TollRo · România" : b.road.regime === "vignette" ? t("Rovinietă · România|Vignette · Romania|Winieta · Rumunia") : t("Taxe de drum · de verificat|Road tolls · to check|Opłaty drogowe · do sprawdzenia"), b.road.category, b.road.euro ? `Euro ${b.road.euro}` : ""].filter(Boolean).join(" · ")}</T>
        {b.road.documents.map(d => <View key={d.type} style={st.docRow}><View style={{ flex: 1 }}><T w="medium">{VEHICLE_DOC[d.type] ? t(VEHICLE_DOC[d.type]) : d.type}</T><T style={{ color: C.fg2, fontSize: 13 }}>{d.expires ? `${t("expiră|expires|wygasa")} ${fmtDate(loc, d.expires)}` : "—"}</T></View><Badge label={t(COMPLIANCE[d.state] ?? COMPLIANCE.unknown)} tone={tone(d.state)} /></View>)}
        <Btn kind="sec" label={t("Portalul oficial eToll ↗|Official eToll portal ↗|Oficjalny portal eToll ↗")} onPress={() => void Linking.openURL("https://portal.etoll.ro/")} />
      </> : <T style={st.empty}>{t("Niciun document aici.|No documents here.|Brak dokumentów.")}</T>}
    </Section> : null}
    {b.paperwork?.length ? <Section title={t("Primite de firmă|Received by the company|Odebrane przez firmę")} count={b.paperwork.length}>
      {b.paperwork.slice(-8).reverse().map(f => <View key={f.id} style={st.docRow}><T w="semi" style={{ fontSize: 14, width: 44 }}>{f.kind.toUpperCase()}</T><T lines={1} style={{ flex: 1, color: C.fg2, fontSize: 13 }}>{titleOf(f.tripId)}</T><T style={{ color: C.fg3, fontSize: 12 }}>{fmtDate(loc, f.createdAt.slice(0, 10))}</T></View>)}
    </Section> : null}
  </View>;
}
export function Profile({ c, onLang, lang, push, onSignOut, onRefresh, pendingWork, cleanup, pendingControl }: {
  c: Ctx; lang: Loc | null; onLang: (l: Loc | null) => void; onSignOut: () => void; onRefresh: () => void; pendingWork: number; cleanup: number; pendingControl: boolean;
  push: { enabled: boolean; message: string; toggle: () => void; test: () => void; settings: () => void };
}) {
  const { t, loc } = useT();
  const b = c.board, p = b.progress, point = b.position;
  return <View>
    <View style={{ alignItems: "center", gap: 6, marginTop: 8 }}>
      <View style={st.avatar}><T w="semi" style={{ fontSize: 30, lineHeight: 36, color: C.acc }}>{(b.name ?? "?").trim().charAt(0).toUpperCase()}</T></View>
      <T w="semi" style={{ fontSize: 24, lineHeight: 30 }}>{b.name}</T>
      <T style={{ color: C.fg2 }}>{[b.phone, b.firm].filter(Boolean).join(" · ")}</T>
    </View>
    <Section title={t("Camionul meu|My truck|Mój pojazd")}><Card><T w="semi" style={{ fontSize: 22, lineHeight: 28 }}>{b.truck?.plate ?? t("Nealocat|Unassigned|Nieprzypisany")}</T></Card></Section>
    <Section title={t("Limba|Language|Język")}>
      <View style={{ flexDirection: "row", gap: 8 }}>{LOCS.map(l => <Pressable key={l} accessibilityRole="radio" accessibilityState={{ selected: loc === l }} onPress={() => onLang(l)} style={[st.lang, loc === l && { backgroundColor: mix(C.acc, 14, C.bg2), borderColor: C.acc }]}><T w="semi" style={{ color: loc === l ? C.acc : C.fg2 }}>{l.toUpperCase()}</T></Pressable>)}
        {lang ? <Pressable accessibilityRole="button" onPress={() => onLang(null)} style={st.lang}><T style={{ color: C.fg2, fontSize: 13 }}>{t("Ca telefonul|Like phone|Jak telefon")}</T></Pressable> : null}</View>
    </Section>
    {p ? <Section title={t("Progres|Progress|Postępy")}><Card>
      <T w="bold" style={{ color: C.pos, fontSize: 40, lineHeight: 46 }}>{p.completed}</T>
      <T style={{ color: C.fg2, fontSize: 14 }}>{t("livrări cu POD în ultimele 30 de zile|deliveries with POD in the last 30 days|dostaw z POD w ostatnich 30 dniach")}</T>
      {p.rank ? <T>{t(`Locul ${p.rank} din ${p.participants}|Rank ${p.rank} of ${p.participants}|Miejsce ${p.rank} z ${p.participants}`)}</T> : null}
      {p.badges.map(x => <T key={x.count} style={{ color: C.pos, fontSize: 14 }}>★ {x.label}</T>)}
    </Card></Section> : null}
    {point ? <Section title={t("Poziția trimisă firmei|Position sent to the company|Pozycja wysłana firmie")}><Card>
      <T>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</T><T style={{ color: C.fg2, fontSize: 13 }}>{fmtDateTime(loc, point.at)}{point.accuracy != null ? ` · ±${Math.round(point.accuracy)} m` : ""}</T>
      <Btn kind="sec" label={t("Vezi pe hartă ↗|View on map ↗|Zobacz na mapie ↗")} onPress={() => void Linking.openURL(`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=16/${point.lat}/${point.lng}`)} />
    </Card></Section> : null}
    <Section title={t("Notificări|Notifications|Powiadomienia")}><Card>
      {push.message ? <T style={{ color: C.warn, fontSize: 14 }}>{push.message}</T> : null}
      <T style={{ color: C.fg2, fontSize: 14 }}>{push.enabled ? t("Notificări activate pe acest telefon.|Notifications are on for this phone.|Powiadomienia włączone na tym telefonie.") : t("Activează notificările pentru acte și verificări.|Turn on notifications for documents and checks.|Włącz powiadomienia o dokumentach i kontrolach.")}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Btn kind="sec" label={push.enabled ? t("Oprește notificările|Turn off|Wyłącz") : t("Activează notificările|Turn on notifications|Włącz powiadomienia")} onPress={push.toggle} style={st.small} />
        {push.enabled ? <Btn kind="ghost" label={t("Testează|Test|Test")} onPress={push.test} style={st.small} /> : null}
        <Btn kind="ghost" label={t("Setări|Settings|Ustawienia")} onPress={push.settings} style={st.small} />
      </View>
    </Card></Section>
    <View style={{ gap: 10, marginTop: 22 }}>
      <Btn kind="sec" style={{ alignSelf: "stretch" }} label={t("Deschide interfața web ↗|Open the web app ↗|Otwórz wersję web ↗")} onPress={() => void Linking.openURL(`${apiOriginSafe()}/driver`)} />
      <Btn kind="sec" style={{ alignSelf: "stretch" }} label={t("Reîmprospătează|Refresh|Odśwież")} onPress={onRefresh} />
      {pendingWork ? <T style={{ color: C.fg2, fontSize: 13 }}>{t(`Ai ${pendingWork} operațiuni pe telefon. Se păstrează pentru același cont; sincronizează înainte să ștergi aplicația.|${pendingWork} actions on this phone. They are kept for this account; sync before deleting the app.|${pendingWork} operacji w telefonie. Zostają dla tego konta; zsynchronizuj przed usunięciem aplikacji.`)}</T> : null}
      {pendingControl ? <T style={{ color: C.fg2, fontSize: 13 }}>{t("Comanda de tură așteaptă internetul; GPS rămâne oprit.|The shift command is waiting for internet; GPS stays off.|Polecenie zmiany czeka na internet; GPS pozostaje wyłączony.")}</T> : null}
      {cleanup ? <T style={{ color: C.fg2, fontSize: 13 }}>{t("Oprirea notificărilor pe server așteaptă conexiunea.|Turning off notifications on the server is waiting for a connection.|Wyłączenie powiadomień na serwerze czeka na połączenie.")}</T> : null}
      <Btn kind="danger" style={{ alignSelf: "stretch" }} label={t("Ieși din cont · oprește GPS|Sign out · stops GPS|Wyloguj · wyłącza GPS")} onPress={onSignOut} />
    </View>
  </View>;
}
let originGetter: () => string = () => "https://fleet.querra.net";
export function setOrigin(fn: () => string) { originGetter = fn; }
const apiOriginSafe = () => originGetter();
export const st = StyleSheet.create({
  current: { padding: 20, borderRadius: 20, gap: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2 },
  card: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 18, gap: 10 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  warn: { color: C.warn, fontSize: 14, lineHeight: 20 },
  empty: { color: C.fg2, fontSize: 14 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: mix(C.neg, 12, C.bg2), borderWidth: 1, borderColor: mix(C.neg, 35, C.bg2) },
  bannerN: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.neg, alignItems: "center", justifyContent: "center" },
  gps: { marginTop: 16, padding: 16, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start", paddingRight: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  ok: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, backgroundColor: mix(C.pos, 10, C.bg2) },
  small: { minHeight: 42, paddingVertical: 8, paddingHorizontal: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: mix(C.acc, 16, C.bg2), alignItems: "center", justifyContent: "center" },
  lang: { minHeight: 44, minWidth: 56, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2, alignItems: "center", justifyContent: "center" },
});
