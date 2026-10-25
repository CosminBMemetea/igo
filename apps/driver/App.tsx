import { logout, recoverLogout } from "./src/logout";
import { pendingRevocations, syncRevocations } from "./src/cleanup";
import { enablePush, disablePush, syncPush, pushActive, testPush, listenPush } from "./src/notifications";
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Alert, AppState, Keyboard, KeyboardAvoidingView, Platform, Linking, Pressable, ScrollView, StatusBar, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { api, apiOrigin, ApiError, read, write, rememberLogoutReceipt, type Login, type Gate, type Pending, sessionScope } from "./src/api";
import { startGPS, stopGPS, preparePrivateOrStop, syncPending, reconcileGPS, type GPSStatus } from "./src/tracking";
import { pendingControl } from "./src/controls";
import { openLocationSettings, useLocationServices } from "./src/location-services";
import { createActions } from "./src/actions";
import { tripFocus, invitationPhone, type Board, type Trip } from "./src/board";
import { workQueue, workId, discardWork, cleanConfirmedPhotos, watchWork } from "./src/work-storage";
import { projectedBoard, unconfirmed, type WorkEntry, type EventKind } from "./src/work-queue";
import { confirmTripEvent } from "./src/trip-confirmation";
import { captureDocument, recoverDocument } from "./src/paperwork";
import type { SpeedWarning } from "./src/speed-alert";
import { C, F, mix } from "./src/theme";
import { LocContext, LOCS, deviceLoc, tri, type Loc } from "./src/i18n";
import { boardToday, missingDocs, tripDocs } from "./src/checklist";
import { Btn, Note, T } from "./src/ui/kit";
import { ShiftBar } from "./src/ui/ShiftBar";
import { TabBar, type Page } from "./src/ui/TabBar";
import { DocumentPreview } from "./src/ui/DocumentPreview";
import { Docs, Home, Profile, TripDetail, Trips, setOrigin, type Ctx } from "./src/ui/screens";
setOrigin(apiOrigin);
const EVENT_TITLE: Record<EventKind, string> = { loaded: "Încărcare|Loading|Załadunek", unloaded: "Descărcare|Unloading|Rozładunek", wait_start: "Început așteptare|Waiting started|Początek oczekiwania", wait_end: "Sfârșit așteptare|Waiting ended|Koniec oczekiwania" };
function Screen() {
  const [logged, setLogged] = useState(false), [ready, setReady] = useState(false), [phone, setPhone] = useState(""), [pin, setPin] = useState("");
  const [board, setBoard] = useState<Board | null>(null), [gps, setGPS] = useState<GPSStatus | null>(null), [gate, setGate] = useState<Gate | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false), [pushMessage, setPushMessage] = useState("");
  const [pushActionMessage, setPushActionMessage] = useState("");
  const authRevision = useRef(0), signingOut = useRef(false);
  const [cleanupCount, setCleanupCount] = useState(0);
  const [page, setPage] = useState<Page>("today");
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [online, setOnline] = useState(false), [syncing, setSyncing] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [lang, setLang] = useState<Loc | null>(null), [openTrip, setOpenTrip] = useState<string | null>(null);
  const loadedDrafts = useRef(false);
  const localRevision = useRef(0);
  const boardScope = useRef("");
  const localLock = useRef(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [withoutTrip, setWithoutTrip] = useState(false);
  const consentOpen = useRef(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  function revealInput() {
    const input = TextInput.State.currentlyFocusedInput();
    if (Platform.OS === "android" && input) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(input, 24, true);
  }
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", revealInput);
    return () => subscription.remove();
  }, []);
  const workKey = useRef("");
  const refreshing = useRef<Promise<void> | null>(null);
  const [actions] = useState(() => createActions(() => refreshing.current, setBusy));
  function navigate(next: Page) { setPage(next); setOpenTrip(null); scroll.current?.scrollTo({ y: 0, animated: false }); }
  async function refresh(force = false) {
    if (refreshing.current) return refreshing.current;
    const revision = authRevision.current;
    const job = (async () => {
      setSyncing(true);
      const scope = await sessionScope();
      const login = await read<Login>("login");
      try {
        // Privacy commands remain first: GPS stopping must not wait for a photo upload.
        await syncPending();
        await reconcileGPS();
        let workError: unknown;
        try { await workQueue.sync(scope, force); } catch (e) { workError = e; }
        if (workError instanceof ApiError && workError.status === 401) throw workError;
        const value = await api<Board>("/api/driver/mobile", undefined, { scope });
        if (revision !== authRevision.current || await sessionScope() !== scope) return;
        if (value.logoutReceipt && login) await rememberLogoutReceipt(login.token, value.logoutReceipt);
        const active = await read<Gate>("gps-gate");
        if (active && (!value.truck || value.truck.id !== active.vehicleId || value.shift?.start !== active.shiftStart || value.shift.end || value.shift.privateSince)) await stopGPS("GPS oprit • tura s-a schimbat");
        const key = `${value.truck?.id}:${value.shift?.start}:${value.shift?.end}`;
        if (key !== workKey.current) { setWithoutTrip(false); workKey.current = key; }
        await workQueue.cache(scope, value);
        await cleanConfirmedPhotos(scope);
        if (revision !== authRevision.current) return;
        setOnline(true); setError("");
        try { await syncPush(); setPushEnabled(await pushActive()); setPushMessage(""); }
        catch (e) { setPushEnabled(await pushActive().catch(() => false)); setPushMessage(e instanceof Error ? e.message : "Notificările nu s-au sincronizat. Reîncearcă din Cont."); }
      } catch (e) {
        if (revision !== authRevision.current) return;
        setOnline(false);
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          await logout(); setLogged(false); setBoard(null); setEntries([]); setReviewId(null); setSyncedAt(null); loadedDrafts.current = false;
        }
        throw e;
      }
    })();
    refreshing.current = job;
    try { await job; } finally { refreshing.current = null; setSyncing(false); await refreshLocal(); }
  }
  useEffect(() => {
    if (logged) return;
    const accept = (url: string) => { const value = invitationPhone(url); if (value) setPhone(value); };
    void Linking.getInitialURL().then(url => { if (url) accept(url); }).catch(() => {});
    const listener = Linking.addEventListener("url", ({ url }) => accept(url));
    return () => listener.remove();
  }, [logged]);
  useEffect(() => { void recoverLogout().then(() => read<Login>("login")).then(value => { setLogged(!!value); }).catch(() => setError("Stocarea securizată nu este disponibilă. Reîncearcă autentificarea.")).finally(() => setReady(true)); }, []);
  useEffect(() => {
    let disposed = false;
    const update = async () => {
      if (AppState.currentState !== "active") return;
      try { await syncRevocations(); if (!disposed) setCleanupCount(await pendingRevocations()); }
      catch { /* Durable queue remains available after storage/network recovery. */ }
    };
    void update(); const timer = setInterval(() => void update(), 15000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") void update(); });
    return () => { disposed = true; clearInterval(timer); sub.remove(); };
  }, []);
  useEffect(() => {
    if (!logged) return;
    const update = () => { const revision = authRevision.current; if (AppState.currentState === "active" && !actions.busy()) void refresh().catch(e => { if (revision === authRevision.current) setError(e.message); }); };
    void run(async () => { await recoverDocument(); await refreshLocal(); await refresh(); });
    update(); const timer = setInterval(update, 15000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") update(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [logged]);
  useEffect(() => {
    if (!logged) return;
    return listenPush(() => { navigate("documents"); if (!actions.busy()) void refresh().catch(e => setError(e.message)); }, setError);
  }, [logged]);
  const [speedWarn, setSpeedWarn] = useState<SpeedWarning | null>(null);
  useEffect(() => {
    if (!logged) return;
    const tick = () => { void read<SpeedWarning>("speed-warning").then(w => setSpeedWarn(w && Date.now() - w.at < 60000 ? w : null)).catch(() => {}); };
    tick(); const timer = setInterval(tick, 5000); return () => clearInterval(timer);
  }, [logged]);
  useEffect(() => { if (logged) return watchWork(() => { void refreshLocal(); }); }, [logged]);
  async function refreshLocal() {
    const revision = ++localRevision.current;
    try {
      const [value, active, login] = await Promise.all([read<GPSStatus>("gps-status"), read<Gate>("gps-gate"), read<Login>("login")]);
      if (!login || revision !== localRevision.current) return;
      const scope = await sessionScope();
      const [local, snapshot, control] = await Promise.all([workQueue.list(scope), workQueue.snapshot(scope), pendingControl()]);
      if (await sessionScope() !== scope || revision !== localRevision.current) return;
      setGPS(value); setGate(active);
      setEntries(local); setPending(control);
      if (snapshot) { boardScope.current = scope; setBoard(projectedBoard(snapshot, local)); setSyncedAt(snapshot.savedAt); }
      if (!loadedDrafts.current) { loadedDrafts.current = true; setReviewId(local.find(e => e.status === "draft")?.id ?? null); }
    } catch { setError("Datele locale nu pot fi citite. Nu șterge aplicația; verifică spațiul disponibil sau contactează suportul."); }
  }
  async function signOut() {
    if (signingOut.current) return;
    signingOut.current = true; ++authRevision.current; ++localRevision.current; actions.invalidate(); setError("");
    try { await logout(); }
    catch (e) { setError(e instanceof Error ? e.message : "Deconectarea nu a putut fi salvată. Reîncearcă."); }
    finally {
      try {
      if (!await read<Login>("login")) {
        setLogged(false); setBoard(null); setEntries([]); setPending(null); setReviewId(null); setSyncedAt(null); setOnline(false);
        setPushEnabled(false); setPushMessage(""); setPushActionMessage(""); setGPS(null); setGate(null); setWithoutTrip(false);
        loadedDrafts.current = false; boardScope.current = ""; workKey.current = ""; navigate("today");
        setCleanupCount(await pendingRevocations()); void syncRevocations().catch(() => {});
      }
      } catch { setError("Stocarea telefonului nu a confirmat deconectarea. Reîncearcă; GPS a fost oprit."); }
      signingOut.current = false;
    }
  }
  /** Serialized action; resolves true only when it finished without an error (ShiftBar uses it for the Private undo toast). */
  async function run(fn: () => Promise<void>, prepare?: () => Promise<void>): Promise<boolean> {
    const revision = authRevision.current;
    setError("");
    try { await actions.run(fn, prepare ? async () => { try { await prepare(); } finally { await refreshLocal(); } } : undefined); return true; }
    catch (e) { if (revision === authRevision.current) setError(e instanceof Error ? e.message : "Operația nu a reușit."); return false; }
    finally { await refreshLocal(); }
  }
  async function pushAction(task: () => Promise<void>) {
    setPushActionMessage("");
    try { await task(); }
    catch (e) { setPushActionMessage(e instanceof Error ? e.message : "Notificările nu au putut fi actualizate."); }
  }
  async function localRun(fn: () => Promise<void>) {
    if (localLock.current) return;
    localLock.current = true; setLocalBusy(true); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Operația nu a fost salvată."); }
    finally { await refreshLocal(); localLock.current = false; setLocalBusy(false); }
  }
  function syncSoon() { void refresh().catch(e => setError(e instanceof ApiError ? e.message : "Conexiunea nu este disponibilă. Operațiunile salvate rămân pe telefon.")); }
  const focus = tripFocus(board);
  const savedLang = useRef(false);
  useEffect(() => { void read<Loc>("lang").then(v => { if (v && LOCS.includes(v)) setLang(v); }).catch(() => {}).finally(() => { savedLang.current = true; }); }, []);
  const loc: Loc = lang ?? (board?.locale && (LOCS as string[]).includes(board.locale) ? board.locale as Loc : deviceLoc());
  const t = (s: string) => tri(loc, s);
  function chooseLang(next: Loc | null) { setLang(next); void write("lang", next).catch(() => {}); }
  async function activateGPS() {
    if (consentOpen.current || busy) return;
    consentOpen.current = true;
    try {
      const scope = await sessionScope();
      const saved = await read<{ scope: string; version: number }>("gps-disclosure");
      if (saved?.scope === scope && saved.version === 1) { await run(startGPS); return; }
      const accepted = await new Promise<boolean>(resolve => Alert.alert(t("GPS în tură|GPS on shift|GPS na zmianie"), t("Poziția este trimisă firmei inclusiv cu ecranul blocat, numai după activarea ta. Privat, Oprește GPS și încheierea turei opresc colectarea. Fără internet rămân goluri în traseu.|Your position is sent to the company even with the screen locked, only after you turn it on. Private, Stop GPS and ending the shift stop collection. Without internet there will be gaps in the route.|Pozycja jest wysyłana firmie także przy zablokowanym ekranie, tylko po Twojej zgodzie. Tryb prywatny, Wyłącz GPS i koniec zmiany zatrzymują zbieranie. Bez internetu powstaną luki w trasie."), [{ text: t("Mai târziu|Later|Później"), style: "cancel", onPress: () => resolve(false) }, { text: t("Activează GPS|Turn on GPS|Włącz GPS"), onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
      if (accepted && await sessionScope() === scope) await run(async () => { await startGPS(); await write("gps-disclosure", { scope, version: 1 }); });
    } catch (e) { setError(e instanceof Error ? e.message : "GPS nu a pornit."); }
    finally { consentOpen.current = false; }
  }
  const stale = !syncedAt || Date.now() - syncedAt > 86400000 || Date.now() < syncedAt - 300000;
  function tripEvent(trip: Trip, kind: EventKind) {
    const expectedScope = boardScope.current;
    Alert.alert(`${t(EVENT_TITLE[kind])} · ${t("confirmi?|confirm?|potwierdzasz?")}`, trip.title + (kind === "unloaded" ? `\n${t("După descărcare, adaugă dovada livrării (POD).|After unloading, add the proof of delivery (POD).|Po rozładunku dodaj potwierdzenie dostawy (POD).")}` : ""), [{ text: t("Anulează|Cancel|Anuluj"), style: "cancel" }, { text: t("Confirmă|Confirm|Potwierdź"), onPress: () => void localRun(async () => {
      const scope = await sessionScope();
      if (scope !== expectedScope || !board?.shift || pending || await pendingControl()) throw new Error("Actualizează datele cursei înainte de a confirma etapa.");
      const [snapshot, local] = await Promise.all([workQueue.snapshot(scope), workQueue.list(scope)]);
      const current = confirmTripEvent(snapshot, local, { tripId: trip.id, truckId: trip.truckId, shiftStart: board.shift.start, kind });
      await workQueue.add({ id: workId(), scope, type: "event", tripId: current.id, title: current.title, kind,
        truckId: current.truckId, shiftStart: board.shift.start, createdAt: new Date().toISOString(), status: "queued", attempts: 0, nextAttempt: 0 });
      await refreshLocal(); syncSoon();
    }) }]);
  }
  function chooseDocument(trip: Trip, kind: "cmr" | "pod", replaceId?: string) {
    const expectedScope = boardScope.current;
    Alert.alert(`${kind.toUpperCase()} · ${trip.title}`, t("Alege o fotografie clară a documentului.|Choose a clear photo of the document.|Wybierz wyraźne zdjęcie dokumentu."), [
      { text: t("Camera|Camera|Aparat"), onPress: () => capture("camera") }, { text: t("Galerie|Gallery|Galeria"), onPress: () => capture("library") }, { text: t("Anulează|Cancel|Anuluj"), style: "cancel" },
    ]);
    function capture(source: "camera" | "library") { void localRun(async () => {
      if (await sessionScope() !== expectedScope) throw new Error("Contul s-a schimbat. Reia operația în contul corect.");
      const id = await captureDocument(trip, kind, source, replaceId);
      if (!id) return;
      const local = await workQueue.list(await sessionScope());
      setEntries(local); setReviewId(id); navigate("documents");
    }); }
  }
  function discard(id: string) {
    Alert.alert(t("Elimini operația de pe telefon?|Remove this action from the phone?|Usunąć operację z telefonu?"), t("O operație deja primită de firmă nu poate fi anulată de aici. Etapele care depind de aceasta vor necesita verificare.|An action the company already received cannot be undone here. Steps that depend on it will need checking.|Operacji odebranej już przez firmę nie można tu cofnąć. Zależne etapy będą wymagały sprawdzenia."), [{ text: t("Păstrează|Keep|Zachowaj"), style: "cancel" }, { text: t("Elimină local|Remove locally|Usuń lokalnie"), style: "destructive", onPress: () => void localRun(async () => { await discardWork(await sessionScope(), id); if (reviewId === id) setReviewId(null); }) }]);
  }
  async function retry(id: string) { const scope = await sessionScope(); await workQueue.submit(scope, id); await refreshLocal(); syncSoon(); }
  const review = entries.find(e => e.id === reviewId) ?? null;
  const pendingWork = entries.filter(unconfirmed).length;
  const attention = entries.filter(e => e.status === "attention").length;
  const insets = useSafeAreaInsets();
  const onShift = !!board?.shift && !board.shift.end, priv = onShift && !!board?.shift?.privateSince;
  const location = useLocationServices(logged && (onShift || !!gate));
  const today = board ? boardToday(board) : "";
  const docs = board ? tripDocs(board, entries) : {};
  const missing = board ? missingDocs(board, docs, today) : [];
  const ctx: Ctx | null = board ? { board: pending || !online ? { ...board, position: null } : board, entries, today, docs, missing,
    busy: busy || localBusy || !!pending || stale, canWork: onShift && !priv, locked: !!pending || stale,
    blockedTrips: entries.filter(e => e.status === "attention").map(e => e.tripId), onEvent: tripEvent, onDocument: chooseDocument,
    openTrip: id => { setOpenTrip(id); setPage("trips"); scroll.current?.scrollTo({ y: 0, animated: false }); }, goDocs: () => navigate("documents") } : null;
  const shiftBlocked = !board?.truck || !!pending || (!onShift && !focus.hasWork && !withoutTrip);
  const syncTone = attention ? C.neg : online && !pendingWork && !pending && !stale ? C.pos : C.warn;
  const syncLabel = attention ? t(`${attention} de verificat|${attention} to check|${attention} do sprawdzenia`) : syncing ? t("Sincronizare…|Syncing…|Synchronizacja…") : pendingWork ? t(`${pendingWork} pe telefon|${pendingWork} on phone|${pendingWork} w telefonie`) : online && !pending && !stale ? t("Actualizat|Up to date|Aktualne") : t("Offline");
  const tripOpen = openTrip ? Object.values(board?.trips ?? {}).flat().find(x => x.id === openTrip) ?? null : null;
  const pendingNote = !!pending && <Note>{t(pending.path === "/api/driver/shift" ? "Încheierea turei așteaptă confirmarea firmei. GPS este oprit pe acest telefon; reîncercăm automat când ai internet.|Ending the shift is waiting for the company. GPS is off on this phone; we retry automatically when you are online.|Zakończenie zmiany czeka na firmę. GPS jest wyłączony; ponowimy automatycznie po połączeniu." : "Modul Privat așteaptă confirmarea firmei. GPS este oprit pe acest telefon; reîncercăm automat când ai internet.|Private mode is waiting for the company. GPS is off on this phone; we retry automatically when you are online.|Tryb prywatny czeka na firmę. GPS jest wyłączony; ponowimy automatycznie po połączeniu.")}</Note>;
  const staleNote = stale && !!board && <Note>{t("Datele au peste 24 de ore sau ora telefonului s-a schimbat. Reconectează-te înainte de a confirma etape.|Data is over 24 hours old or the phone clock changed. Reconnect before confirming steps.|Dane mają ponad 24 godziny lub zmieniono zegar telefonu. Połącz się przed potwierdzeniem etapów.")}</Note>;
  // Curse list owns its scrolling: pinned segmented control + swipeable pages, each with its own vertical scroll.
  const tripsList = ready && logged && !!ctx && page === "trips" && !tripOpen;
  const login = async () => { Keyboard.dismiss(); scroll.current?.scrollTo({ y: 0, animated: true }); await recoverLogout(); const value = await api<Login>("/api/auth/mobile", { login: phone.trim(), password: pin }, { anonymous: true }); await stopGPS(); ++authRevision.current; await write("login", { ...value, origin: apiOrigin() }); setPin(""); setLogged(true); await refresh(); };
  return <LocContext.Provider value={loc}><SafeAreaView edges={["top", "left", "right"]} style={s.safe}><StatusBar barStyle="light-content"/><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "android" ? "height" : undefined}>
    {speedWarn && gate ? <View style={s.speed} accessibilityRole="alert"><T w="bold" style={{ color: "#fff", fontSize: 15, flex: 1 }}>{t(`Ai depășit limita setată de firmă (${speedWarn.limit} km/h)|Over the company limit (${speedWarn.limit} km/h)|Przekroczono limit firmy (${speedWarn.limit} km/h)`)}</T><T w="bold" style={{ color: "#fff", fontSize: 30, lineHeight: 36 }}>{speedWarn.kmh}</T></View> : null}
    {logged ? <View style={s.header}>
      <View style={s.brand}><View style={s.mark}><T w="bold" style={{ color: "#fff", fontSize: 15, lineHeight: 20 }}>Q</T></View><T w="semi" style={{ fontSize: 17 }}>{t("Șofer|Driver|Kierowca")}</T></View>
      <Pressable accessibilityRole="button" accessibilityLabel={syncLabel} onPress={() => navigate("documents")} style={s.pill}><View style={[s.dot, { backgroundColor: syncTone }]} /><T w="medium" style={{ fontSize: 13, color: C.fg2 }}>{syncLabel}</T></Pressable>
    </View> : null}
    {tripsList && ctx ? <View style={{ flex: 1 }}>
      {error || pendingNote || staleNote ? <View style={s.notes}>{!!error && <Note tone="bad">{error}</Note>}{pendingNote}{staleNote}</View> : null}
      <Trips c={ctx} />
    </View> : <ScrollView onLayout={() => { if (Keyboard.isVisible()) revealInput(); }} ref={scroll} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    {!!error && <Note tone="bad">{error}</Note>}
    {!ready ? <T style={{ color: C.fg2 }}>{t("Se încarcă…|Loading…|Ładowanie…")}</T> : !logged ? <View style={{ gap: 14, marginTop: 24 }}>
      <View style={[s.mark, { width: 56, height: 56, borderRadius: 16 }]}><T w="bold" style={{ color: "#fff", fontSize: 28, lineHeight: 34 }}>Q</T></View>
      <T w="semi" style={{ fontSize: 30, lineHeight: 36 }}>Querra {t("Șofer|Driver|Kierowca")}</T>
      <T style={{ color: C.fg2 }}>{t("Camionul, cursele și tura ta, într-un singur loc.|Your truck, trips and shift in one place.|Twój pojazd, kursy i zmiana w jednym miejscu.")}</T>
      {cleanupCount > 0 && <Note tone="info">{t("Ești deconectat pe acest telefon. Revocarea accesului pe server se confirmă când revine internetul.|You are signed out on this phone. Server-side revocation is confirmed when internet returns.|Wylogowano na tym telefonie. Odwołanie dostępu na serwerze potwierdzi się po powrocie internetu.")}</Note>}
      <T w="medium" style={s.label}>{t("Telefon|Phone|Telefon")}</T><TextInput accessibilityLabel={t("Telefon|Phone|Telefon")} onFocus={revealInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholderTextColor={C.fg3} placeholder="07xx xxx xxx" style={s.input} />
      <T w="medium" style={s.label}>{t("PIN / parolă|PIN / password|PIN / hasło")}</T><TextInput accessibilityLabel={t("PIN sau parolă|PIN or password|PIN lub hasło")} onFocus={revealInput} value={pin} onChangeText={setPin} secureTextEntry autoComplete="current-password" style={s.input} />
      <Btn style={{ alignSelf: "stretch", marginTop: 6 }} disabled={busy} label={t("Intră în cont|Sign in|Zaloguj się")} onPress={() => void run(login)} />
    </View> : <>
      {pendingNote}
      {!board && <><T style={{ color: C.fg2 }}>{t("Conectăm datele firmei…|Loading company data…|Ładowanie danych firmy…")}</T><Btn label={t("Reîncearcă actualizarea|Retry update|Ponów aktualizację")} disabled={busy} onPress={() => void run(() => refresh(true))} /></>}
      {staleNote}
      {ctx && page === "today" && <Home c={ctx} gps={gps} gate={!!gate} gpsBlocked={busy || !!pending || !onShift || priv} onActivateGPS={() => void activateGPS()} onStopGPS={() => void run(async () => {}, stopGPS)} withoutTrip={withoutTrip} onWithoutTrip={() => setWithoutTrip(true)}
        locationOff={location.off} onLocationSettings={() => void openLocationSettings().then(() => location.check())} />}
      {ctx && page === "trips" && tripOpen ? <TripDetail c={ctx} trip={tripOpen} onBack={() => setOpenTrip(null)} /> : null}
      {ctx && page === "documents" && <Docs c={ctx} onReview={setReviewId} onRetry={id => void localRun(() => retry(id))} onDiscard={discard} onSync={() => void run(() => refresh(true))} syncedAt={syncedAt} syncing={syncing} />}
      {ctx && page === "account" && <Profile c={ctx} lang={lang} onLang={chooseLang} onSignOut={() => void signOut()} onRefresh={() => void run(() => refresh(true))} pendingWork={pendingWork} cleanup={cleanupCount} pendingControl={!!pending}
        push={{ enabled: pushEnabled, message: pushActionMessage || pushMessage, toggle: () => void pushAction(async () => { if (pushEnabled) await disablePush(); else await enablePush(); setPushEnabled(await pushActive()); }),
          test: () => void pushAction(async () => { await testPush(); Alert.alert(t("Test acceptat|Test accepted|Test przyjęty"), t("Furnizorul a acceptat trimiterea. Verifică dacă notificarea ajunge pe telefon.|The provider accepted it. Check that the notification arrives.|Dostawca przyjął wysyłkę. Sprawdź, czy powiadomienie dotarło.")); }),
          settings: () => void Linking.openSettings() }} />}
    </>}
  </ScrollView>}</KeyboardAvoidingView>
    {logged && board ? <ShiftBar state={!onShift ? "off" : priv ? "priv" : "on"} start={onShift ? board.shift?.start : null} plate={board.truck?.plate ?? ""} busy={busy || localBusy} blocked={shiftBlocked}
      offSub={!board.truck ? t("Niciun camion alocat|No truck assigned|Brak przypisanego pojazdu") : pending ? t("Așteaptă confirmarea firmei|Waiting for the company|Czeka na firmę") : !focus.hasWork && !withoutTrip ? t("Nicio cursă de pornit|No trip to start|Brak kursu") : t("Verifică camionul și pornește|Check the truck and start|Sprawdź pojazd i zacznij")}
      gpsNote={onShift && !priv && !gate ? t("GPS oprit pe telefon|GPS off on phone|GPS wyłączony w telefonie") : undefined}
      onStart={async checks => { const ok = await run(async () => { await api("/api/driver/shift", { vehicleId: board.truck!.id, action: "start", checklist: checks }); await refresh(); }); if (ok) void activateGPS(); return ok; }}
      onStop={() => run(refresh, () => preparePrivateOrStop({ path: "/api/driver/shift", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, action: "stop" } }))}
      onPrivate={async on => {
        if (on) return run(refresh, () => preparePrivateOrStop({ path: "/api/driver/private", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: true } }));
        const ok = await run(async () => { await api("/api/driver/private", { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: false }); await refresh(); });
        if (ok) void activateGPS(); return ok;
      }} /> : null}
    {logged ? <TabBar page={page} onPage={navigate} badge={missing.length} bottom={insets.bottom} /> : null}
    <DocumentPreview entry={review} busy={busy || localBusy} onClose={() => setReviewId(null)} onSend={() => { if (review) void localRun(async () => { const id = review.id; setReviewId(null); await retry(id); }); }} onRetake={() => { if (review?.type === "file") { const trip = Object.values(board?.trips ?? {}).flat().find(x => x.id === review.tripId); if (trip && !trip.cancelledAt) chooseDocument(trip, review.kind, review.id); else Alert.alert(t("Cursa nu mai este disponibilă|Trip no longer available|Kurs niedostępny"), t("Fotografia rămâne pe telefon. Verifică alocarea cu patronul.|The photo stays on the phone. Check the assignment with the owner.|Zdjęcie zostaje w telefonie. Sprawdź przydział z właścicielem.")); } }} />
  </SafeAreaView></LocContext.Provider>;
}
function Fonts({ children }: { children: ReactNode }) {
  // Android embeds Inter through the expo-font config plugin; this also loads it for expo web previews.
  useFonts({ "Inter-Regular": require("./assets/fonts/Inter-Regular.ttf"), "Inter-Medium": require("./assets/fonts/Inter-Medium.ttf"), "Inter-SemiBold": require("./assets/fonts/Inter-SemiBold.ttf"), "Inter-Bold": require("./assets/fonts/Inter-Bold.ttf") });
  return <>{children}</>;
}
export default function App() { return <SafeAreaProvider><Fonts><Screen /></Fonts></SafeAreaProvider>; }
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.accBtn, alignItems: "center", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 20, paddingBottom: 32, gap: 14, width: "100%", maxWidth: 680, alignSelf: "center" },
  label: { color: C.fg2, fontSize: 14 },
  notes: { paddingHorizontal: 20, paddingTop: 12, gap: 10, width: "100%", maxWidth: 680, alignSelf: "center" },
  input: { backgroundColor: C.bg2, borderRadius: 12, padding: 16, color: C.fg, fontSize: 18, minHeight: 56, borderColor: C.line, borderWidth: 1, fontFamily: F.regular },
  speed: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: mix(C.neg, 80, "#000000"), paddingHorizontal: 16, paddingVertical: 12 },
});
