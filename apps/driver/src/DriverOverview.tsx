import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tripFocus, type Board, type Trip } from "./board";
type Props = { board: Board; busy: boolean; onEvent: (trip: Trip, kind: "loaded" | "unloaded") => void; onOpen: (url: string) => void };
const titles: Record<string, string> = { running: "În desfășurare", ready: "De încărcat", upcoming: "Planificată", documents: "Livrată · lipsește POD", finished: "Încheiată", cancelled: "Anulată" };
const types: Record<string, string> = { rca: "RCA", itp: "ITP", vignette: "Rovinietă", tollro: "TollRo", classification: "Datele din talon", casco: "CASCO", tacho: "Tahograf", copy: "Copie conformă", service: "Revizie" };
const states: Record<string, string> = { valid: "În termen · declarat", soon: "Expiră curând", urgent: "Expiră în ≤ 7 zile", expired: "Expirat", missing: "Lipsește din evidență", unknown: "De verificat", future: "Nu a început încă" };
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("ro-RO");
export function TripOverview({ board, busy, onEvent }: Props) {
  const [tab, setTab] = useState("now");
  const { current, next } = tripFocus(board);
  const groups = board.trips;
  const keys = tab === "now" ? ["running", "ready"] : tab === "next" ? ["upcoming"] : ["documents", "finished", "cancelled"];
  const canWork = !!board.shift && !board.shift.end && !board.shift.privateSince;
  const card = (trip: Trip, stage: string) => <View key={trip.id} style={s.row}>
    <Text style={s.accent}>{titles[stage]}</Text><Text style={s.heading}>{trip.title}</Text><Text style={s.muted}>{date(trip.date)}{trip.client ? ` · ${trip.client}` : ""}</Text>
    {trip.truckId !== board.truck?.id && ["running", "ready", "upcoming"].includes(stage) && <Text style={s.warn}>Alt camion decât cel alocat. Verifică împreună cu patronul.</Text>}
    {trip.truckId === board.truck?.id && ["running", "ready"].includes(stage) && <>
      <Pressable accessibilityRole="button" disabled={busy || !canWork || !!trip.waitSince} onPress={() => onEvent(trip, stage === "running" ? "unloaded" : "loaded")} style={[s.action, (busy || !canWork || !!trip.waitSince) && s.disabled]}><Text style={s.actionText}>{stage === "running" ? "Confirmă descărcarea" : "Confirmă încărcarea"}</Text></Pressable>
      {!canWork && <Text style={s.muted}>Începe tura de lucru și ieși din modul Privat pentru a confirma etapa cursei.</Text>}
      {!!trip.waitSince && <Text style={s.warn}>Oprește așteptarea din interfața web înainte de a confirma etapa.</Text>}
    </>}
    {stage === "documents" && <Text style={s.warn}>Livrarea este înregistrată. Trimite dovada livrării (POD) din interfața web pentru încheiere.</Text>}
    {stage === "cancelled" && !!trip.cancelReason && <Text style={s.muted}>{trip.cancelReason}</Text>}
  </View>;
  return <View style={s.card}>
    <Text style={s.eyebrow}>CURSELE MELE</Text>
    <Text style={s.heading}>{current ? "Ai o cursă în desfășurare" : "Nicio cursă în desfășurare"}</Text>
    {!current && <Text style={s.muted}>{next ? `Următoarea: ${next.title} · ${date(next.date)}` : "Patronul nu ți-a atribuit alte curse. Lista se actualizează automat."}</Text>}
    {(groups.running?.length ?? 0) > 1 && <Text style={s.warn}>Mai multe curse sunt marcate încărcate. Verifică situația cu patronul.</Text>}
    <View style={s.tabs}>{[["now", "Acum", (groups.running?.length ?? 0) + (groups.ready?.length ?? 0)], ["next", "Urmează", groups.upcoming?.length ?? 0], ["past", "Istoric", (groups.documents?.length ?? 0) + (groups.finished?.length ?? 0) + (groups.cancelled?.length ?? 0)]].map(([key, label, count]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: tab === key }} style={[s.tab, tab === key && s.selected]} onPress={() => setTab(String(key))}><Text style={s.text}>{label} · {count}</Text></Pressable>)}</View>
    {keys.flatMap(key => (groups[key] ?? []).map(trip => card(trip, key)))}
    {!keys.some(key => groups[key]?.length) && <Text style={s.muted}>{tab === "now" ? "Nu ai curse de făcut acum." : tab === "next" ? "Nu ai curse viitoare." : "Nu ai încă un istoric de curse."}</Text>}
  </View>;
}
export function DriverDetails({ board, onOpen }: Props) {
  const [tab, setTab] = useState("road"), road = board.road, p = board.progress, point = board.position;
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const age = point ? now - Date.parse(point.at) : Infinity;
  const fresh = age >= -5000 && age <= 90000;
  return <View style={s.card}>
    <View style={s.tabs}>{[["road", "Acte & taxe"], ["progress", "Progres"], ["map", "Poziție"]].map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: tab === key }} style={[s.tab, tab === key && s.selected]} onPress={() => setTab(key)}><Text style={s.text}>{label}</Text></Pressable>)}</View>
    {tab === "road" && <>
      <Text style={s.heading}>{road?.regime === "tollro" ? "TollRo · România" : road?.regime === "vignette" ? "Rovinietă · România" : "Taxe de drum · de verificat"}</Text>
      {!road ? <Text style={s.muted}>Datele apar după atribuirea unui camion.</Text> : <>
        <Text style={s.text}>{board.truck?.plate} · {road.category ?? "Categorie necunoscută"}</Text>
        <Text style={s.muted}>MTMA: {road.mtmaKg ? `${road.mtmaKg.toLocaleString("ro-RO")} kg` : "de completat"} · Euro: {road.euro ?? "de completat"}</Text>
        {road.documents.map(d => <View key={d.type} style={s.row}><Text style={s.text}>{types[d.type] ?? d.type}</Text><Text style={d.state === "valid" ? s.accent : s.warn}>{states[d.state] ?? "De verificat"}{d.expires ? ` · ${date(d.expires)}` : ""}</Text></View>)}
        <Pressable accessibilityRole="link" style={s.action} onPress={() => onOpen("https://portal.etoll.ro/")}><Text style={s.actionText}>Deschide portalul oficial ↗</Text></Pressable>
        <Text style={s.muted}>Verifică obligațiile și plata pentru traseul tău. Querra nu cumpără tichetul și nu confirmă plata; GPS-ul Querra nu înlocuiește serviciul TollRo.</Text>
      </>}
    </>}
    {tab === "progress" && <>
      <Text style={s.heading}>Progres și distincții</Text>
      {!p ? <Text style={s.muted}>Progresul așteaptă actualizarea serverului.</Text> : <>
        <Text style={s.number}>{p.completed}</Text><Text style={s.muted}>livrări cu POD în ultimele 30 de zile</Text>
        <Text style={s.text}>{p.rank ? `Locul ${p.rank} din ${p.participants} șoferi cu livrări documentate` : p.participants < 3 ? "Clasamentul apare de la 3 șoferi cu livrări documentate în această perioadă." : "O livrare cu POD în această perioadă te include în clasament."}</Text>
        {p.badges.map(b => <Text key={b.count} style={s.accent}>★ {b.label}</Text>)}
        {p.next && <Text style={s.muted}>Următoarea distincție: {p.next.label} · încă {Math.max(0, p.next.count - p.lifetime)}.</Text>}
        <Text style={s.muted}>Distincțiile nu au valoare în bani. Clasamentul măsoară activitatea documentată, nu siguranța sau consumul. Numărul de curse depinde și de alocările firmei.</Text>
      </>}
    </>}
    {tab === "map" && <>
      <Text style={s.heading}>Poziția transmisă firmei</Text>
      {point ? <><Text style={fresh ? s.accent : s.warn}>{fresh ? "Poziție recentă" : "Ultima poziție cunoscută · nu este live"}</Text><Text style={s.text}>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Text><Text style={s.muted}>{new Date(point.at).toLocaleString("ro-RO")}{point.accuracy != null ? ` · precizie ±${Math.round(point.accuracy)} m` : ""}</Text><Pressable accessibilityRole="link" style={s.action} onPress={() => onOpen(`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=16/${point.lat}/${point.lng}`)}><Text style={s.actionText}>Vezi poziția pe hartă ↗</Text></Pressable><Text style={s.muted}>Deschide harta externă pentru coordonatele afișate.</Text></> : <Text style={s.muted}>{board.shift?.privateSince ? "Mod Privat: nu afișăm o poziție live." : "Nicio poziție recentă confirmată în această tură. Activează GPS în tură; în interior poate dura până obții o poziție precisă."}</Text>}
    </>}
  </View>;
}
const s = StyleSheet.create({ card: { backgroundColor: "#142137", padding: 18, borderRadius: 22, gap: 12, borderWidth: 1, borderColor: "#253853" }, heading: { color: "#f5f7fc", fontSize: 20, fontWeight: "700" }, text: { color: "#eef4ff", fontSize: 15, lineHeight: 22 }, muted: { color: "#aabbd1", fontSize: 14, lineHeight: 21 }, accent: { color: "#80e2c2", fontSize: 14, fontWeight: "600" }, warn: { color: "#f6cb86", fontSize: 14, lineHeight: 21 }, eyebrow: { color: "#80e2c2", fontSize: 12, fontWeight: "700", letterSpacing: 1.5 }, row: { paddingTop: 14, borderTopWidth: 1, borderColor: "#30445e", gap: 8 }, tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, tab: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: "#0a1220", minHeight: 48, justifyContent: "center" }, selected: { backgroundColor: "#31514c" }, action: { backgroundColor: "#80e2c2", borderRadius: 14, padding: 14, minHeight: 52, justifyContent: "center", alignItems: "center" }, actionText: { color: "#09241c", fontSize: 16, fontWeight: "700", textAlign: "center" }, disabled: { opacity: .45 }, number: { color: "#80e2c2", fontSize: 42, fontWeight: "700" } });
