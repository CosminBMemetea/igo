import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, apiOrigin, ApiError, read, write, remove, type Login, type Gate } from "./src/api";
import { startGPS, stopGPS, privateOrStop, syncPending, type GPSStatus } from "./src/tracking";
type Trip = { id: string; title: string; date: string; client: string };
type Board = { name: string; firm: string; truck: { id: string; plate: string } | null; shift: { start: string; end: string | null; privateSince?: string | null } | null; trips: Record<string, Trip[]> };
const sections = [["running", "În curs acum"], ["ready", "De început"], ["upcoming", "Urmează"], ["documents", "Livrate • lipsesc documente"], ["finished", "Încheiate"], ["cancelled", "Anulate"]];
const checks = [["chk.tyres", "Anvelope"], ["chk.fluids", "Lichide"], ["chk.docs", "Documente"], ["chk.damage", "Starea camionului"]];
function Screen() {
  const [logged, setLogged] = useState(false), [ready, setReady] = useState(false), [phone, setPhone] = useState(""), [pin, setPin] = useState("");
  const [board, setBoard] = useState<Board | null>(null), [gps, setGPS] = useState<GPSStatus | null>(null), [gate, setGate] = useState<Gate | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [selected, setSelected] = useState<string[]>([]);
  const workKey = useRef("");
  const lock = useRef(false), refreshing = useRef<Promise<void> | null>(null);
  async function refresh() {
    if (refreshing.current) return refreshing.current;
    const job = (async () => {
    try {
      await syncPending();
      const value = await api<Board>("/api/driver/mobile");
      const active = await read<Gate>("gps-gate");
      if (active && (!value.truck || value.truck.id !== active.vehicleId || value.shift?.start !== active.shiftStart || value.shift.end || value.shift.privateSince)) await stopGPS("GPS oprit • tura s-a schimbat");
      const key = `${value.truck?.id}:${value.shift?.start}:${value.shift?.end}`;
      if (key !== workKey.current) { setSelected([]); workKey.current = key; }
      setBoard(value); setGPS(await read<GPSStatus>("gps-status")); setGate(await read<Gate>("gps-gate"));
    } catch (e) {
      if (e instanceof ApiError && [401, 403].includes(e.status)) { await stopGPS("Autentifică-te din nou • GPS oprit"); setLogged(false); setBoard(null); }
      throw e;
    }
    })();
    refreshing.current = job;
    try { await job; } finally { refreshing.current = null; setGPS(await read<GPSStatus>("gps-status")); setGate(await read<Gate>("gps-gate")); }
  }
  useEffect(() => { void read<Login>("login").then(value => { setLogged(!!value); }).catch(() => setError("Stocarea securizată nu este disponibilă. Reîncearcă autentificarea.")).finally(() => setReady(true)); }, []);
  useEffect(() => {
    if (!logged) return;
    const update = () => { if (AppState.currentState === "active" && !lock.current) void refresh().catch(e => setError(e.message)); };
    update(); const timer = setInterval(update, 15000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") update(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [logged]);
  async function run(fn: () => Promise<void>, urgent = false) {
    if (urgent) {
      try { await stopGPS(); } catch (e) { setError(e instanceof Error ? e.message : "Oprirea GPS nu a fost confirmată."); return; }
      if (lock.current) { setError("GPS oprit local. Așteaptă operația în curs și reîncearcă pentru confirmarea pe server."); return; }
    }
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { await refreshing.current?.catch(() => {}); await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Operația nu a reușit."); }
    finally {
      try { setGPS(await read<GPSStatus>("gps-status")); setGate(await read<Gate>("gps-gate")); }
      catch { setError("Starea locală nu poate fi citită. Verifică stocarea securizată înainte de a reactiva GPS."); }
      finally { lock.current = false; setBusy(false); }
    }
  }
  const button = (label: string, action: () => Promise<void>, secondary = false, urgent = false) => <Pressable accessibilityRole="button" disabled={busy && !urgent} onPress={() => void run(action, urgent)} style={[s.button, secondary && s.secondary, busy && !urgent && { opacity: .5 }]}><Text style={[s.buttonText, secondary && { color: "#eef4ff" }]}>{label}</Text></Pressable>;
  const consent = () => new Promise<void>((resolve) => Alert.alert("GPS în tură", "Poziția este trimisă firmei tale, inclusiv cu ecranul blocat. Modul Privat, Oprește GPS și încheierea turei opresc colectarea. Fără internet rămân goluri în traseu. În Setări, acordă locația precisă și accesul în fundal.", [{ text: "Mai târziu", style: "cancel", onPress: resolve }, { text: "Activează GPS", onPress: () => { void run(startGPS).finally(resolve); } }]));
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" /><ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>QUERRA / ȘOFER</Text><Text style={s.title}>{logged ? board?.name ?? "Ziua ta de lucru" : "Bun venit la bord"}</Text>
    <Text style={s.muted}>{logged ? board?.firm ?? "Conectăm datele firmei…" : "Camionul, cursele și tura ta, într-un singur loc."}</Text>
    {!!error && <View accessibilityRole="alert" style={s.error}><Text style={s.text}>{error}</Text></View>}
    {!ready ? <Text style={s.text}>Se încarcă…</Text> : !logged ? <View style={s.card}>
      <Text style={s.label}>Telefon</Text><TextInput accessibilityLabel="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" style={s.input} />
      <Text style={s.label}>PIN / parolă</Text><TextInput accessibilityLabel="PIN sau parolă" value={pin} onChangeText={setPin} secureTextEntry autoComplete="current-password" style={s.input} />
      {button("Intră în cont", async () => { const login = await api<Login>("/api/auth/mobile", { login: phone.trim(), password: pin }, { anonymous: true }); await stopGPS(); await write("login", { ...login, origin: apiOrigin() }); setPin(""); setLogged(true); await refresh(); })}
    </View> : <>
      <View style={s.card}><Text style={s.label}>CAMIONUL TĂU</Text><Text style={s.truck}>{board?.truck?.plate ?? "Niciun camion atribuit"}</Text>
        <Text style={s.muted}>{board?.shift && !board.shift.end ? board.shift.privateSince ? "Tură deschisă • mod Privat" : "Tură deschisă" : "În afara turei"}</Text>
        {!!board?.truck && (!board.shift || board.shift.end) && <><Text style={s.text}>Verifică minimum 3 puncte înainte de plecare:</Text>{checks.map(([id,label]) => <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(id) }} disabled={busy} style={s.check} onPress={() => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old,id])}><Text style={s.text}>{selected.includes(id) ? "☑" : "☐"}  {label}</Text></Pressable>)}{button("Începe tura", async () => { if (selected.length < 3) throw new Error("Bifează minimum 3 verificări."); await api("/api/driver/shift", { vehicleId: board.truck!.id, action: "start", checklist: selected }); await refresh(); })}</>}
        {!!board?.truck && !!board.shift && !board.shift.end && <>
          {button(board.shift.privateSince ? "Revino din Privat" : "Activează modul Privat", async () => { if (board.shift!.privateSince) await api("/api/driver/private", { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: false }); else await privateOrStop({ path: "/api/driver/private", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, on: true } }); await refresh(); }, true, !board.shift?.privateSince)}
          {button("Încheie tura", async () => { await privateOrStop({ path: "/api/driver/shift", body: { vehicleId: board.truck!.id, expectedShiftStart: board.shift!.start, action: "stop" } }); await refresh(); }, true, true)}
        </>}
      </View>
      <View style={s.card}><Text style={s.label}>GPS PE ACEST TELEFON</Text><Text style={s.subtitle}>{gate ? "Colectare activată" : "Colectare oprită"}</Text><Text style={s.muted}>{gate && gps?.lastAck && Date.now() - Date.parse(gps.lastAck) > 90000 ? "GPS neconfirmat de peste 90 de secunde. Verifică internetul și permisiunile." : gps?.message ?? "Activează GPS după ce începi tura."}</Text>
        {!!gps?.lastAck && <Text style={s.muted}>Ultima confirmare: {new Date(gps.lastAck).toLocaleString("ro-RO")}</Text>}
        <Text style={s.muted}>Sistemul poate întrerupe localizarea dacă închizi forțat aplicația. Verifică ultima confirmare înainte de plecare.</Text>
        {gate ? button("Oprește GPS", async () => { await stopGPS(); }, true, true) : <Pressable accessibilityRole="button" disabled={busy || !board?.shift || !!board.shift.end || !!board.shift.privateSince} style={[s.button, (!board?.shift || !!board.shift.end || !!board.shift.privateSince) && { opacity: .4 }]} onPress={() => void consent()}><Text style={s.buttonText}>Activează GPS în fundal</Text></Pressable>}
        {button("Setările permisiunilor", async () => { await Linking.openSettings(); }, true)}
      </View>
      <Text style={s.title}>Cursele tale</Text>{sections.map(([key,title]) => <View style={s.card} key={key}><Text style={s.subtitle}>{title} · {board?.trips[key]?.length ?? 0}</Text>{board?.trips[key]?.length ? board.trips[key].map(trip => <View key={trip.id} style={s.trip}><Text style={s.text}>{trip.title}</Text><Text style={s.muted}>{trip.date} · {trip.client}</Text></View>) : <Text style={s.muted}>Nicio cursă în această categorie.</Text>}</View>)}
      <Text style={s.muted}>Pilot: încărcarea documentelor și actualizarea etapelor cursei se fac din interfața web a șoferului.</Text>
      {button("Reîmprospătează", refresh, true)}
      {button("Deconectare • oprește GPS", async () => { await stopGPS(); await syncPending(); await remove("login"); setLogged(false); setBoard(null); }, true, true)}
    </>}
  </ScrollView></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Screen /></SafeAreaProvider>; }
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#0a1220" }, content: { padding: 20, gap: 16, width: "100%", maxWidth: 680, alignSelf: "center", paddingBottom: 40 }, eyebrow: { color: "#80e2c2", fontSize: 12, fontWeight: "700", letterSpacing: 2 }, title: { color: "#f5f7fc", fontSize: 30, fontWeight: "700" }, subtitle: { color: "#f5f7fc", fontSize: 20, fontWeight: "600" }, truck: { color: "#f5f7fc", fontSize: 28, fontWeight: "700" }, text: { color: "#eef4ff", fontSize: 16, lineHeight: 24 }, muted: { color: "#aabbd1", fontSize: 14, lineHeight: 22 }, card: { backgroundColor: "#142137", padding: 20, borderRadius: 22, gap: 14, borderColor: "#253853", borderWidth: 1 }, label: { color: "#aabbd1", fontSize: 13, fontWeight: "600" }, input: { backgroundColor: "#0a1220", borderRadius: 12, padding: 16, color: "white", fontSize: 18, minHeight: 54, borderColor: "#3b506a", borderWidth: 1 }, button: { minHeight: 54, backgroundColor: "#80e2c2", borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 14 }, secondary: { backgroundColor: "#22364e" }, buttonText: { color: "#09241c", fontSize: 16, fontWeight: "700", textAlign: "center", flexShrink: 1 }, check: { paddingVertical: 12 }, trip: { paddingTop: 12, borderTopWidth: 1, borderColor: "#30445e", gap: 4 }, error: { backgroundColor: "#532932", padding: 16, borderRadius: 12 } });
