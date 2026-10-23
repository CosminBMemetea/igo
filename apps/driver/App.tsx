import { logout, recoverLogout } from "./src/logout";
import { pendingRevocations, syncRevocations } from "./src/cleanup";
import { enablePush, disablePush, syncPush, pushActive, testPush, listenPush } from "./src/notifications";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Alert, AppState, Keyboard, KeyboardAvoidingView, Platform, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, apiOrigin, ApiError, read, write, rememberLogoutReceipt, type Login, type Gate, type Pending, sessionScope } from "./src/api";
import { startGPS, stopGPS, preparePrivateOrStop, syncPending, reconcileGPS, type GPSStatus } from "./src/tracking";
import { pendingControl } from "./src/controls";
import { createActions } from "./src/actions";
import { tripFocus, invitationPhone, type Board, type Trip } from "./src/board";
import { TripOverview, DriverDetails } from "./src/DriverOverview";
import { workQueue, workId, discardWork, cleanConfirmedPhotos, watchWork } from "./src/work-storage";
import { projectedBoard, unconfirmed, eventLabel, type WorkEntry, type EventKind } from "./src/work-queue";
import { confirmTripEvent } from "./src/trip-confirmation";
import { captureDocument, recoverDocument } from "./src/paperwork";
import { PaperworkPanel, DocumentPreview } from "./src/PaperworkPanel";
import type { SpeedWarning } from "./src/speed-alert";
type Page = "today" | "trips" | "documents" | "account";
const checks = [["chk.tyres", "Anvelope"], ["chk.fluids", "Lichide"], ["chk.docs", "Documente"], ["chk.damage", "Starea camionului"]];
function Screen() {
  const [logged, setLogged] = useState(false), [ready, setReady] = useState(false), [phone, setPhone] = useState(""), [pin, setPin] = useState("");
  const [board, setBoard] = useState<Board | null>(null), [gps, setGPS] = useState<GPSStatus | null>(null), [gate, setGate] = useState<Gate | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [selected, setSelected] = useState<string[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false), [pushMessage, setPushMessage] = useState("");
  const [pushActionMessage, setPushActionMessage] = useState("");
  const authRevision = useRef(0), signingOut = useRef(false);
  const [cleanupCount, setCleanupCount] = useState(0);
  const [page, setPage] = useState<Page>("today");
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [online, setOnline] = useState(false), [syncing, setSyncing] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [gpsExpanded, setGpsExpanded] = useState(false);
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
  function navigate(next: Page) { setPage(next); scroll.current?.scrollTo({ y: 0, animated: false }); }
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
        if (key !== workKey.current) { setSelected([]); setWithoutTrip(false); workKey.current = key; }
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
        setPushEnabled(false); setPushMessage(""); setPushActionMessage(""); setGPS(null); setGate(null); setSelected([]); setWithoutTrip(false);
        loadedDrafts.current = false; boardScope.current = ""; workKey.current = ""; navigate("today");
        setCleanupCount(await pendingRevocations()); void syncRevocations().catch(() => {});
      }
      } catch { setError("Stocarea telefonului nu a confirmat deconectarea. Reîncearcă; GPS a fost oprit."); }
      signingOut.current = false;
    }
  }
  async function run(fn: () => Promise<void>, prepare?: () => Promise<void>) {
    const revision = authRevision.current;
    setError("");
    try { await actions.run(fn, prepare ? async () => { try { await prepare(); } finally { await refreshLocal(); } } : undefined); }
    catch (e) { if (revision === authRevision.current) setError(e instanceof Error ? e.message : "Operația nu a reușit."); }
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
  const button = (label: string, action: () => Promise<void>, secondary = false, prepare?: () => Promise<void>) => <Pressable accessibilityRole="button" disabled={busy && !prepare} onPress={() => void run(action, prepare)} accessibilityState={{ disabled: busy && !prepare }} style={[s.button, secondary && s.secondary, busy && !prepare && { opacity: .5 }]}><Text style={[s.buttonText, secondary && { color: "#eef4ff" }]}>{label}</Text></Pressable>;
  const focus = tripFocus(board);
  async function activateGPS() {
    if (consentOpen.current || busy) return;
    consentOpen.current = true;
    try {
      const scope = await sessionScope();
      const saved = await read<{ scope: string; version: number }>("gps-disclosure");
      if (saved?.scope === scope && saved.version === 1) { await run(startGPS); return; }
      const accepted = await new Promise<boolean>(resolve => Alert.alert("GPS în tură", "Poziția este trimisă firmei inclusiv cu ecranul blocat, numai după activarea ta. Privat, Oprește GPS și încheierea turei opresc colectarea. Fără internet rămân goluri în traseu.", [{ text: "Mai târziu", style: "cancel", onPress: () => resolve(false) }, { text: "Activează GPS", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
      if (accepted && await sessionScope() === scope) await run(async () => { await startGPS(); await write("gps-disclosure", { scope, version: 1 }); });
    } catch (e) { setError(e instanceof Error ? e.message : "GPS nu a pornit."); }
    finally { consentOpen.current = false; }
  }
  const stale = !syncedAt || Date.now() - syncedAt > 86400000 || Date.now() < syncedAt - 300000;
  function tripEvent(trip: Trip, kind: EventKind) {
    const expectedScope = boardScope.current;
    Alert.alert(`${eventLabel[kind]} · confirmi?`, trip.title + (kind === "unloaded" ? "\nDupă descărcare, adaugă dovada livrării (POD)." : ""), [{ text: "Anulează", style: "cancel" }, { text: "Confirmă", onPress: () => void localRun(async () => {
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
    Alert.alert(`${kind.toUpperCase()} · ${trip.title}`, "Alege o fotografie clară a documentului.", [
      { text: "Camera", onPress: () => capture("camera") }, { text: "Galerie", onPress: () => capture("library") }, { text: "Anulează", style: "cancel" },
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
    Alert.alert("Elimini operația de pe telefon?", "O operație deja primită de firmă nu poate fi anulată de aici. Etapele care depind de aceasta vor necesita verificare.", [{ text: "Păstrează", style: "cancel" }, { text: "Elimină local", style: "destructive", onPress: () => void localRun(async () => { await discardWork(await sessionScope(), id); if (reviewId === id) setReviewId(null); }) }]);
  }
  async function retry(id: string) { const scope = await sessionScope(); await workQueue.submit(scope, id); await refreshLocal(); syncSoon(); }
  const review = entries.find(e => e.id === reviewId) ?? null;
  const pendingWork = entries.filter(unconfirmed).length;
  const attention = entries.filter(e => e.status === "attention").length;
  const localCount = `${pendingWork} ${pendingWork === 1 ? "operațiune locală" : "operațiuni locale"}`;
  const overviewProps = board ? { board: pending || !online ? { ...board, position: null } : board, busy: busy || localBusy || !!pending || stale,
    blockedTrips: entries.filter(e => e.status === "attention").map(e => e.tripId), onEvent: tripEvent, onDocument: chooseDocument,
    onOpen: (url: string) => { void run(async () => { await Linking.openURL(url); }); } } : null;
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "android" ? "height" : undefined}>{speedWarn && gate ? <View style={s.speed} accessibilityRole="alert"><Text style={s.speedText}>Ai depășit limita setată de firmă ({speedWarn.limit} km/h)</Text><Text style={s.speedNum}>{speedWarn.kmh}</Text></View> : null}<ScrollView onLayout={() => { if (Keyboard.isVisible()) revealInput(); }} ref={scroll} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>QUERRA / ȘOFER</Text><Text style={s.title}>{logged ? ({ today: "Ziua ta de lucru", trips: "Cursele tale", documents: "Acte și sincronizare", account: "Contul tău" })[page] : "Bun venit la bord"}</Text>
    <Text style={s.muted}>{logged ? board ? `${board.name} · ${board.firm}` : "Conectăm datele firmei…" : "Camionul, cursele și tura ta, într-un singur loc."}</Text>
    {!!error && <View accessibilityRole="alert" style={s.error}><Text style={s.text}>{error}</Text></View>}
    {!ready ? <Text style={s.text}>Se încarcă…</Text> : !logged ? <View style={s.card}>
      {cleanupCount > 0 && <Text style={s.muted}>Ești deconectat pe acest telefon. Revocarea accesului și notificărilor pe server se confirmă când revine internetul și aplicația este deschisă.</Text>}
      <Text style={s.label}>Telefon</Text><TextInput accessibilityLabel="Telefon" onFocus={revealInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" style={s.input} />
      <Text style={s.label}>PIN / parolă</Text><TextInput accessibilityLabel="PIN sau parolă" onFocus={revealInput} value={pin} onChangeText={setPin} secureTextEntry autoComplete="current-password" style={s.input} />
      {button("Intră în cont", async () => { Keyboard.dismiss(); scroll.current?.scrollTo({ y: 0, animated: true }); await recoverLogout(); const login = await api<Login>("/api/auth/mobile", { login: phone.trim(), password: pin }, { anonymous: true }); await stopGPS(); ++authRevision.current; await write("login", { ...login, origin: apiOrigin() }); setPin(""); setLogged(true); await refresh(); })}
    </View> : <>
      {!!pending && <View accessibilityRole="alert" style={s.notice}><Text style={s.text}>{pending.path === "/api/driver/shift" ? "Încheierea turei" : "Modul Privat"} așteaptă confirmarea firmei. GPS este oprit pe acest telefon. Reîncercăm automat când revii în aplicație și ai internet.</Text></View>}
      <Pressable accessibilityRole="button" onPress={() => navigate("documents")} style={s.sync}><View style={[s.dot, { backgroundColor: attention ? "#ff9ba8" : online && !pendingWork && !pending && !stale ? "#80e2c2" : "#f6cb86" }]} /><View style={{ flex: 1 }}><Text style={s.text}>{attention ? `${attention} ${attention === 1 ? "operațiune de verificat" : "operațiuni de verificat"}` : syncing ? "Sincronizare în curs…" : pendingWork ? localCount : online && !pending && !stale ? "Actualizat cu firma" : "Date salvate pe telefon"}</Text><Text style={s.muted}>{syncedAt ? `Ultima actualizare: ${new Date(syncedAt).toLocaleString("ro-RO")}` : "Prima conectare necesită internet"}</Text></View></Pressable>
      {!board && button("Reîncearcă actualizarea", () => refresh(true))}
      {stale && !!board && <Text style={s.muted}>Datele au peste 24 de ore sau ora telefonului s-a schimbat. Reconectează-te înainte de a confirma etape.</Text>}
      {overviewProps && (page === "today" || page === "trips") && <TripOverview key={page} {...overviewProps} compact={page === "today"} onShowTrips={() => navigate("trips")} />}
      {page === "today" && <>
      <View style={s.card}><Text style={s.label}>CAMIONUL TĂU</Text><Text style={s.truck}>{board?.truck?.plate ?? "Niciun camion atribuit"}</Text>
        <Text style={s.muted}>{board?.shift && !board.shift.end ? board.shift.privateSince ? "Tură deschisă • mod Privat" : "Tură deschisă" : "În afara turei"}</Text>
        {!!board?.truck && (!board.shift || board.shift.end) && !focus.hasWork && !withoutTrip && <><Text style={s.muted}>Nu ai o cursă de început cu acest camion. Poți deschide separat o tură pentru deplasări sau alte sarcini.</Text>{button("Lucrez fără cursă alocată", async () => { setWithoutTrip(true); }, true)}</>}
        {!!board?.truck && (!board.shift || board.shift.end) && (focus.hasWork || withoutTrip) && <><Text style={s.text}>Verifică minimum 3 puncte înainte de plecare:</Text>{checks.map(([id,label]) => <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(id) }} disabled={busy} style={s.check} onPress={() => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old,id])}><Text style={s.text}>{selected.includes(id) ? "☑" : "☐"}  {label}</Text></Pressable>)}{button("Începe tura de lucru", async () => { if (selected.length < 3) throw new Error("Bifează minimum 3 verificări."); await api("/api/driver/shift", { vehicleId: board.truck!.id, action: "start", checklist: selected }); await refresh(); })}</>}
        {!!board?.truck && !!board.shift && !board.shift.end && <>
          {button(board.shift.privateSince ? "Revino din Privat" : "Activează modul Privat", async () => { if (board.shift!.privateSince) await api("/api/driver/private", { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: false }); await refresh(); }, true, board.shift.privateSince ? undefined : () => preparePrivateOrStop({ path: "/api/driver/private", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: true } }))}
          {button("Încheie tura", refresh, true, () => preparePrivateOrStop({ path: "/api/driver/shift", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, action: "stop" } }))}
        </>}
      </View>
      <View style={s.card}><Text style={s.label}>GPS PE ACEST TELEFON</Text><Text style={s.subtitle}>{gate ? "Colectare activată" : "Colectare oprită"}</Text><Text style={s.muted}>{gate && gps?.lastAck && Date.now() - Date.parse(gps.lastAck) > 90000 ? "GPS neconfirmat de peste 90 de secunde. Verifică internetul și permisiunile." : gps?.message ?? "Activează GPS după ce începi tura."}</Text>
        {!!gps?.lastAck && <Text style={s.muted}>Ultima confirmare: {new Date(gps.lastAck).toLocaleString("ro-RO")}</Text>}
        {gpsExpanded && <><Text style={s.muted}>Sistemul poate întrerupe localizarea dacă închizi forțat aplicația. Verifică ultima confirmare înainte de plecare.</Text></>}
        {gate ? button("Oprește GPS", async () => {}, true, stopGPS) : <Pressable accessibilityRole="button" disabled={busy || !!pending || !board?.shift || !!board.shift.end || !!board.shift.privateSince} style={[s.button, (busy || !!pending || !board?.shift || !!board.shift.end || !!board.shift.privateSince) && { opacity: .4 }]} onPress={() => void activateGPS()}><Text style={s.buttonText}>Activează GPS în fundal</Text></Pressable>}
        {button(gpsExpanded ? "Mai puține detalii" : "Detalii și permisiuni GPS", async () => { setGpsExpanded(!gpsExpanded); }, true)}
        {gpsExpanded && button("Setările permisiunilor", async () => { await Linking.openSettings(); }, true)}
      </View>
      </>}
      {page === "documents" && <>
      {board && <PaperworkPanel board={board} entries={entries} busy={busy || localBusy} onCapture={chooseDocument} onReview={setReviewId} onRetry={id => void localRun(() => retry(id))} onDiscard={discard} />}
      {overviewProps && <DriverDetails {...overviewProps} section="road" />}
      <View style={s.card}><Text style={s.subtitle}>Alertele tale · {board?.alerts?.length ?? 0}</Text>
        {board?.alerts?.length ? board.alerts.map(alert => <View key={alert.id} style={s.trip}><Text style={s.text}>{alert.kind === "compliance-task" ? "Verificare solicitată" : "Document de verificat"} · {alert.label}</Text><Text style={s.muted}>{({ rca: "RCA", itp: "ITP", vignette: "Rovinietă", licence: "Permis", cpc: "Atestat", tachoCard: "Card tahograf", medical: "Aviz medical" } as Record<string, string>)[alert.type] ?? alert.type} · {alert.expires}</Text></View>) : <Text style={s.muted}>Nu ai alerte active.</Text>}
      </View>
      {button("Sincronizează acum", () => refresh(true), true)}
      </>}
      {page === "account" && <>
      <View style={s.card}><Text style={s.subtitle}>Notificări și acces</Text>
        {!!(pushActionMessage || pushMessage) && <Text accessibilityRole="alert" style={s.muted}>{pushActionMessage || pushMessage}</Text>}
        <Text style={s.muted}>{pushEnabled ? "Notificări activate pe acest dispozitiv. Sunt legate de sesiunea ta; reautentifică-te când expiră." : "Activează notificările pentru documente și verificări. Detaliile apar doar în aplicație."}</Text>
        {<>{button(pushEnabled ? "Oprește notificările" : "Activează notificările", () => pushAction(async () => { if (pushEnabled) await disablePush(); else await enablePush(); setPushEnabled(await pushActive()); }), true)}{pushEnabled && button("Testează notificarea", () => pushAction(async () => { await testPush(); Alert.alert("Test acceptat", "Furnizorul a acceptat trimiterea. Verifică dacă notificarea ajunge pe telefon; acceptarea nu confirmă recepția."); }), true)}</>}
        {button("Setările notificărilor", async () => { await Linking.openSettings(); }, true)}
      </View>
      <Text style={s.muted}>CMR/POD sunt disponibile în Acte. Interfața web rămâne disponibilă pentru celelalte opțiuni ale contului.</Text>
      {button("Deschide interfața web", async () => { await Linking.openURL(`${apiOrigin()}/driver`); }, true)}
      {button("Reîmprospătează", () => refresh(true), true)}
      {!!pendingWork && <Text style={s.muted}>Ai {localCount}. După deconectare se păstrează pentru același cont; sincronizează înainte de a șterge aplicația.</Text>}
      {!!pending && <Text style={s.muted}>Comanda de tură așteaptă internetul. Dacă te deconectezi, o reluăm la următoarea autentificare în același cont; GPS rămâne oprit.</Text>}
      {cleanupCount > 0 && <Text style={s.muted}>Oprirea notificărilor pe server așteaptă conexiunea.</Text>}
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={[s.button, s.secondary]}><Text style={s.buttonText}>Deconectare • oprește GPS</Text></Pressable>
      {overviewProps && <DriverDetails {...overviewProps} section="account" />}
      </>}
    </>}
  </ScrollView></KeyboardAvoidingView>
    {logged && <View style={s.navigation}>{([["today", "Azi", "◉"], ["trips", "Curse", "↗"], ["documents", "Acte", "▤"], ["account", "Cont", "●"]] as const).map(([key, label, icon]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: page === key }} accessibilityLabel={label + (key === "documents" && pendingWork ? `, ${localCount}` : "")} style={[s.navItem, page === key && s.navSelected]} onPress={() => navigate(key)}><Text style={[s.navIcon, page === key && s.navActive]}>{key === "documents" && pendingWork ? pendingWork : icon}</Text><Text style={[s.navLabel, page === key && s.navActive]}>{label}</Text></Pressable>)}</View>}
    <DocumentPreview entry={review} busy={busy || localBusy} onClose={() => setReviewId(null)} onSend={() => { if (review) void localRun(async () => { const id = review.id; setReviewId(null); await retry(id); }); }} onRetake={() => { if (review?.type === "file") { const trip = Object.values(board?.trips ?? {}).flat().find(t => t.id === review.tripId); if (trip && !trip.cancelledAt) chooseDocument(trip, review.kind, review.id); else Alert.alert("Cursa nu mai este disponibilă", "Fotografia rămâne pe telefon. Verifică alocarea cu patronul înainte de a o înlocui sau trimite."); } }} />
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Screen /></SafeAreaProvider>; }
const s = StyleSheet.create({ sync: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: "#122534", padding: 14 }, dot: { width: 8, height: 8, borderRadius: 4 }, navigation: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 6, borderTopWidth: 1, borderColor: "#253853", backgroundColor: "#0d1929" }, navItem: { flex: 1, minHeight: 60, paddingVertical: 7, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 14 }, navSelected: { backgroundColor: "#213d3a" }, navIcon: { color: "#8499b3", fontSize: 20, fontWeight: "600" }, navLabel: { color: "#aabbd1", fontSize: 12, fontWeight: "600" }, navActive: { color: "#80e2c2" }, safe: { flex: 1, backgroundColor: "#0a1220" }, content: { padding: 20, gap: 16, width: "100%", maxWidth: 680, alignSelf: "center", paddingBottom: 40 }, eyebrow: { color: "#80e2c2", fontSize: 12, fontWeight: "700", letterSpacing: 2 }, title: { color: "#f5f7fc", fontSize: 30, fontWeight: "700" }, subtitle: { color: "#f5f7fc", fontSize: 20, fontWeight: "600" }, truck: { color: "#f5f7fc", fontSize: 28, fontWeight: "700" }, text: { color: "#eef4ff", fontSize: 16, lineHeight: 24 }, muted: { color: "#aabbd1", fontSize: 14, lineHeight: 22 }, card: { backgroundColor: "#142137", padding: 20, borderRadius: 22, gap: 14, borderColor: "#253853", borderWidth: 1 }, label: { color: "#aabbd1", fontSize: 13, fontWeight: "600" }, input: { backgroundColor: "#0a1220", borderRadius: 12, padding: 16, color: "white", fontSize: 18, minHeight: 54, borderColor: "#3b506a", borderWidth: 1 }, button: { minHeight: 54, backgroundColor: "#80e2c2", borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 14 }, secondary: { backgroundColor: "#22364e" }, buttonText: { color: "#09241c", fontSize: 16, fontWeight: "700", textAlign: "center", flexShrink: 1 }, check: { paddingVertical: 12 }, trip: { paddingTop: 12, borderTopWidth: 1, borderColor: "#30445e", gap: 4 }, notice: { backgroundColor: "#284039", padding: 16, borderRadius: 12 }, error: { backgroundColor: "#532932", padding: 16, borderRadius: 12 }, speed: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#b3261e", paddingHorizontal: 16, paddingVertical: 12 }, speedText: { color: "white", fontSize: 15, fontWeight: "700", flex: 1 }, speedNum: { color: "white", fontSize: 30, fontWeight: "800" } });
