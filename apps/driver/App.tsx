import { enablePush, disablePush, syncPush, pushActive, testPush, listenPush } from "./src/notifications";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Alert, AppState, Keyboard, KeyboardAvoidingView, Platform, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, apiOrigin, ApiError, read, write, remove, type Login, type Gate, type Pending, sessionScope } from "./src/api";
import { startGPS, stopGPS, preparePrivateOrStop, syncPending, reconcileGPS, type GPSStatus } from "./src/tracking";
import { pendingControl } from "./src/controls";
import { createActions } from "./src/actions";
import { tripFocus, invitationPhone, type Board, type Trip } from "./src/board";
import { TripOverview, DriverDetails } from "./src/DriverOverview";
const checks = [["chk.tyres", "Anvelope"], ["chk.fluids", "Lichide"], ["chk.docs", "Documente"], ["chk.damage", "Starea camionului"]];
function Screen() {
  const [logged, setLogged] = useState(false), [ready, setReady] = useState(false), [phone, setPhone] = useState(""), [pin, setPin] = useState("");
  const [board, setBoard] = useState<Board | null>(null), [gps, setGPS] = useState<GPSStatus | null>(null), [gate, setGate] = useState<Gate | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [selected, setSelected] = useState<string[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false), [pushMessage, setPushMessage] = useState("");
  const alertPosition = useRef(0);
  const [withoutTrip, setWithoutTrip] = useState(false);
  const consentOpen = useRef(false);
  const eventKeys = useRef(new Map<string, string>());
  const openAlerts = useRef(false);
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
  async function refresh() {
    if (refreshing.current) return refreshing.current;
    const job = (async () => {
    try {
      await syncPending();
      await reconcileGPS();
      try { await syncPush(); setPushEnabled(await pushActive()); setPushMessage(""); } catch { setPushMessage("Sincronizarea notificărilor nu a reușit. GPS și cursele rămân disponibile. Reîncearcă activarea push."); }
      const value = await api<Board>("/api/driver/mobile");
      const active = await read<Gate>("gps-gate");
      if (active && (!value.truck || value.truck.id !== active.vehicleId || value.shift?.start !== active.shiftStart || value.shift.end || value.shift.privateSince)) await stopGPS("GPS oprit • tura s-a schimbat");
      const key = `${value.truck?.id}:${value.shift?.start}:${value.shift?.end}`;
      if (key !== workKey.current) { setSelected([]); setWithoutTrip(false); workKey.current = key; }
      setBoard(value);
      if (openAlerts.current) { openAlerts.current = false; setTimeout(() => scroll.current?.scrollTo({ y: alertPosition.current, animated: true }), 100); }
      setGPS(await read<GPSStatus>("gps-status")); setGate(await read<Gate>("gps-gate")); setError("");
    } catch (e) {
      if (e instanceof ApiError && [401, 403].includes(e.status)) { await stopGPS("Autentifică-te din nou • GPS oprit"); setLogged(false); setBoard(null); }
      throw e;
    }
    })();
    refreshing.current = job;
    try { await job; } finally { refreshing.current = null; await refreshLocal(); }
  }
  useEffect(() => {
    if (logged) return;
    const accept = (url: string) => { const value = invitationPhone(url); if (value) setPhone(value); };
    void Linking.getInitialURL().then(url => { if (url) accept(url); }).catch(() => {});
    const listener = Linking.addEventListener("url", ({ url }) => accept(url));
    return () => listener.remove();
  }, [logged]);
  useEffect(() => { void read<Login>("login").then(value => { setLogged(!!value); }).catch(() => setError("Stocarea securizată nu este disponibilă. Reîncearcă autentificarea.")).finally(() => setReady(true)); }, []);
  useEffect(() => {
    if (!logged) return;
    const update = () => { if (AppState.currentState === "active" && !actions.busy()) void refresh().catch(e => setError(e.message)); };
    update(); const timer = setInterval(update, 15000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") update(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [logged]);
  useEffect(() => {
    if (!logged) return;
    return listenPush(() => { openAlerts.current = true; if (!actions.busy()) void refresh().catch(e => setError(e.message)); }, setError);
  }, [logged]);
  async function refreshLocal() {
    try { const [value, active] = await Promise.all([read<GPSStatus>("gps-status"), read<Gate>("gps-gate")]); setGPS(value); setGate(active); setPending(await read<Login>("login") ? await pendingControl() : null); }
    catch { setError("Starea locală nu poate fi citită. Verifică stocarea securizată înainte de a reactiva GPS."); }
  }
  async function run(fn: () => Promise<void>, prepare?: () => Promise<void>) {
    setError("");
    try { await actions.run(fn, prepare ? async () => { try { await prepare(); } finally { await refreshLocal(); } } : undefined); }
    catch (e) { setError(e instanceof Error ? e.message : "Operația nu a reușit."); }
    finally { await refreshLocal(); }
  }
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
  function tripEvent(trip: Trip, kind: "loaded" | "unloaded") {
    Alert.alert(kind === "loaded" ? "Confirmi încărcarea?" : "Confirmi descărcarea?", trip.title + (kind === "unloaded" ? "\nLivrarea va rămâne la documente până trimiți POD-ul." : ""), [{ text: "Anulează", style: "cancel" }, { text: "Confirmă", onPress: () => void run(async () => {
      const scope = await sessionScope(), id = `${scope}:${trip.id}:${kind}`;
      const key = eventKeys.current.get(id) ?? `native-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      eventKeys.current.set(id, key);
      await api("/api/trips/event", { tripId: trip.id, kind, key }, { scope });
      eventKeys.current.delete(id); await refresh();
    }) }]);
  }
  const overviewProps = board ? { board: pending ? { ...board, position: null } : board, busy: busy || !!pending, onEvent: tripEvent, onOpen: (url: string) => { void run(async () => { await Linking.openURL(url); }); } } : null;
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "android" ? "height" : undefined}><ScrollView onLayout={() => { if (Keyboard.isVisible()) revealInput(); }} ref={scroll} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>QUERRA / ȘOFER</Text><Text style={s.title}>{logged ? board?.name ?? "Ziua ta de lucru" : "Bun venit la bord"}</Text>
    <Text style={s.muted}>{logged ? board?.firm ?? "Conectăm datele firmei…" : "Camionul, cursele și tura ta, într-un singur loc."}</Text>
    {!!error && <View accessibilityRole="alert" style={s.error}><Text style={s.text}>{error}</Text></View>}
    {!ready ? <Text style={s.text}>Se încarcă…</Text> : !logged ? <View style={s.card}>
      <Text style={s.label}>Telefon</Text><TextInput accessibilityLabel="Telefon" onFocus={revealInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" style={s.input} />
      <Text style={s.label}>PIN / parolă</Text><TextInput accessibilityLabel="PIN sau parolă" onFocus={revealInput} value={pin} onChangeText={setPin} secureTextEntry autoComplete="current-password" style={s.input} />
      {button("Intră în cont", async () => { Keyboard.dismiss(); scroll.current?.scrollTo({ y: 0, animated: true }); const login = await api<Login>("/api/auth/mobile", { login: phone.trim(), password: pin }, { anonymous: true }); await stopGPS(); await write("login", { ...login, origin: apiOrigin() }); setPin(""); setLogged(true); await refresh(); })}
    </View> : <>
      {!!pending && <View accessibilityRole="alert" style={s.notice}><Text style={s.text}>{pending.path === "/api/driver/shift" ? "Încheierea turei" : "Modul Privat"} așteaptă confirmarea firmei. GPS este oprit pe acest telefon. Reîncercăm automat când revii în aplicație și ai internet.</Text></View>}
      {overviewProps && <TripOverview {...overviewProps} />}
      <View style={s.card}><Text style={s.label}>CAMIONUL TĂU</Text><Text style={s.truck}>{board?.truck?.plate ?? "Niciun camion atribuit"}</Text>
        <Text style={s.muted}>{board?.shift && !board.shift.end ? board.shift.privateSince ? "Tură deschisă • mod Privat" : "Tură deschisă" : "În afara turei"}</Text>
        {!!board?.truck && (!board.shift || board.shift.end) && !focus.hasWork && !withoutTrip && <><Text style={s.muted}>Nu ai o cursă de început cu acest camion. Poți deschide separat o tură pentru deplasări sau alte sarcini.</Text>{button("Lucrez fără cursă alocată", async () => { setWithoutTrip(true); }, true)}</>}
        {!!board?.truck && (!board.shift || board.shift.end) && (focus.hasWork || withoutTrip) && <><Text style={s.text}>Verifică minimum 3 puncte înainte de plecare:</Text>{checks.map(([id,label]) => <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(id) }} disabled={busy} style={s.check} onPress={() => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old,id])}><Text style={s.text}>{selected.includes(id) ? "☑" : "☐"}  {label}</Text></Pressable>)}{button("Începe tura de lucru", async () => { if (selected.length < 3) throw new Error("Bifează minimum 3 verificări."); await api("/api/driver/shift", { vehicleId: board.truck!.id, action: "start", checklist: selected }); await refresh(); })}</>}
        {!!board?.truck && !!board.shift && !board.shift.end && <>
          {button(board.shift.privateSince ? "Revino din Privat" : "Activează modul Privat", async () => { if (board.shift!.privateSince) await api("/api/driver/private", { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: false }); await refresh(); }, true, board.shift.privateSince ? undefined : () => preparePrivateOrStop({ path: "/api/driver/private", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: true } }))}
          {button("Încheie tura", refresh, true, () => preparePrivateOrStop({ path: "/api/driver/shift", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, action: "stop" } }))}
        </>}
      </View>
      {overviewProps && <DriverDetails {...overviewProps} />}
      <View style={s.card}><Text style={s.label}>GPS PE ACEST TELEFON</Text><Text style={s.subtitle}>{gate ? "Colectare activată" : "Colectare oprită"}</Text><Text style={s.muted}>{gate && gps?.lastAck && Date.now() - Date.parse(gps.lastAck) > 90000 ? "GPS neconfirmat de peste 90 de secunde. Verifică internetul și permisiunile." : gps?.message ?? "Activează GPS după ce începi tura."}</Text>
        {!!gps?.lastAck && <Text style={s.muted}>Ultima confirmare: {new Date(gps.lastAck).toLocaleString("ro-RO")}</Text>}
        <Text style={s.muted}>Sistemul poate întrerupe localizarea dacă închizi forțat aplicația. Verifică ultima confirmare înainte de plecare.</Text>
        {gate ? button("Oprește GPS", async () => {}, true, stopGPS) : <Pressable accessibilityRole="button" disabled={busy || !!pending || !board?.shift || !!board.shift.end || !!board.shift.privateSince} style={[s.button, (busy || !!pending || !board?.shift || !!board.shift.end || !!board.shift.privateSince) && { opacity: .4 }]} onPress={() => void activateGPS()}><Text style={s.buttonText}>Activează GPS în fundal</Text></Pressable>}
        {button("Setările permisiunilor", async () => { await Linking.openSettings(); }, true)}
      </View>
      <View style={s.card} onLayout={e => { alertPosition.current = e.nativeEvent.layout.y; }}><Text style={s.subtitle}>Alertele tale · {board?.alerts?.length ?? 0}</Text>
        {board?.alerts?.length ? board.alerts.map(alert => <View key={alert.id} style={s.trip}><Text style={s.text}>{alert.kind === "compliance-task" ? "Verificare solicitată" : "Document de verificat"} · {alert.label}</Text><Text style={s.muted}>{({ rca: "RCA", itp: "ITP", vignette: "Rovinietă", licence: "Permis", cpc: "Atestat", tachoCard: "Card tahograf", medical: "Aviz medical" } as Record<string, string>)[alert.type] ?? alert.type} · {alert.expires}</Text></View>) : <Text style={s.muted}>Nu ai alerte active.</Text>}
        {!!pushMessage && <Text style={s.muted}>{pushMessage}</Text>}
        <Text style={s.muted}>{Platform.OS === "android" ? "Alertele se actualizează când aplicația este deschisă. Notificările push Android nu sunt încă active." : pushEnabled ? "Notificări activate pe acest dispozitiv. Sunt legate de sesiunea ta; reautentifică-te când expiră." : "Activează notificările pentru documente și verificări. Detaliile apar doar în aplicație."}</Text>
        {Platform.OS === "ios" && <>{button(pushEnabled ? "Oprește notificările" : "Activează notificările", async () => { if (pushEnabled) await disablePush(); else await enablePush(); setPushEnabled(await pushActive()); }, true)}{pushEnabled && button("Testează notificarea", async () => { await testPush(); Alert.alert("Test acceptat", "Apple a acceptat testul. Verifică notificările iPhone."); }, true)}</>}
      </View>
      <Text style={s.muted}>Pentru încărcarea documentelor CMR/POD, folosește interfața web a șoferului.</Text>
      {button("Deschide interfața web", async () => { await Linking.openURL(`${apiOrigin()}/driver`); }, true)}
      {button("Reîmprospătează", refresh, true)}
      {button("Deconectare • oprește GPS", async () => { await syncPending(); await disablePush(); await remove("login"); setLogged(false); setBoard(null); }, true, stopGPS)}
    </>}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Screen /></SafeAreaProvider>; }
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#0a1220" }, content: { padding: 20, gap: 16, width: "100%", maxWidth: 680, alignSelf: "center", paddingBottom: 40 }, eyebrow: { color: "#80e2c2", fontSize: 12, fontWeight: "700", letterSpacing: 2 }, title: { color: "#f5f7fc", fontSize: 30, fontWeight: "700" }, subtitle: { color: "#f5f7fc", fontSize: 20, fontWeight: "600" }, truck: { color: "#f5f7fc", fontSize: 28, fontWeight: "700" }, text: { color: "#eef4ff", fontSize: 16, lineHeight: 24 }, muted: { color: "#aabbd1", fontSize: 14, lineHeight: 22 }, card: { backgroundColor: "#142137", padding: 20, borderRadius: 22, gap: 14, borderColor: "#253853", borderWidth: 1 }, label: { color: "#aabbd1", fontSize: 13, fontWeight: "600" }, input: { backgroundColor: "#0a1220", borderRadius: 12, padding: 16, color: "white", fontSize: 18, minHeight: 54, borderColor: "#3b506a", borderWidth: 1 }, button: { minHeight: 54, backgroundColor: "#80e2c2", borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 14 }, secondary: { backgroundColor: "#22364e" }, buttonText: { color: "#09241c", fontSize: 16, fontWeight: "700", textAlign: "center", flexShrink: 1 }, check: { paddingVertical: 12 }, trip: { paddingTop: 12, borderTopWidth: 1, borderColor: "#30445e", gap: 4 }, notice: { backgroundColor: "#284039", padding: 16, borderRadius: 12 }, error: { backgroundColor: "#532932", padding: 16, borderRadius: 12 } });
