import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { entryLabel, type WorkEntry } from "./work-queue";
import { workFile } from "./work-storage";
import type { Board, Trip } from "./board";

const statusLabel = { draft: "De verificat · nu este trimis", queued: "Salvat pe telefon", sending: "În curs de trimitere", attention: "Necesită atenție", confirmed: "Confirmat de firmă" };
type Props = { board: Board; entries: WorkEntry[]; busy: boolean; onCapture: (trip: Trip, kind: "cmr" | "pod") => void;
  onReview: (id: string) => void; onRetry: (id: string) => void; onDiscard: (id: string) => void };
export function PaperworkPanel({ board, entries, busy, onCapture, onReview, onRetry, onDiscard }: Props) {
  const pending = entries.filter(e => e.status !== "confirmed");
  const confirmed = entries.filter(e => e.status === "confirmed").slice(-8).reverse();
  const documents = [...(board.trips.documents ?? []), ...(board.trips.running ?? []), ...(board.trips.ready ?? [])];
  return <>
    <View style={s.card}><Text style={s.heading}>Documentele curselor</Text><Text style={s.muted}>Fotografiază fiecare pagină. Verifică dacă textul și semnăturile se citesc înainte de a trimite.</Text>
      {!documents.length && <Text style={s.text}>Nu ai livrări care așteaptă documente. Pentru o cursă mai veche, deschide Curse → Istoric.</Text>}
      {documents.map(trip => <View key={trip.id} style={s.row}><Text style={s.text}>{trip.title}</Text><Text style={s.muted}>{trip.date}{trip.deliveredAt ? " · lipsește POD" : " · CMR la încărcare"}</Text><View style={s.actions}>
        <Action label="＋ CMR" disabled={busy} onPress={() => onCapture(trip, "cmr")} />
        {!!trip.deliveredAt && <Action label="＋ POD" disabled={busy} onPress={() => onCapture(trip, "pod")} />}
      </View></View>)}
    </View>
    <View style={s.card}><Text style={s.heading}>Sincronizare · {pending.length} de rezolvat</Text>
      <Text style={s.muted}>Reîncercăm cât timp aplicația este deschisă. Nu șterge aplicația înainte de confirmarea operațiunilor locale.</Text>
      {!pending.length && <Text style={s.good}>Nu ai operațiuni în așteptare pe acest telefon.</Text>}
      {[...pending, ...confirmed].map(entry => <View key={entry.id} style={s.row}>
        <Text style={s.text}>{entryLabel(entry)} · {entry.title}</Text>
        <Text style={entry.status === "confirmed" ? s.good : s.warn}>{statusLabel[entry.status]}</Text>
        <Text style={s.muted}>{new Date(entry.createdAt).toLocaleString("ro-RO")}{entry.type === "file" ? ` · ${Math.ceil(entry.size / 1024)} KB` : ""}</Text>
        {!!entry.message && <Text style={s.muted}>{entry.message}</Text>}
        {entry.status !== "confirmed" && <View style={s.actions}>
          {entry.type === "file" && <Action label="Vezi fotografia" disabled={busy} onPress={() => onReview(entry.id)} />}
          {entry.status !== "draft" && <Action label="Reîncearcă" disabled={busy} onPress={() => onRetry(entry.id)} />}
          <Action label="Elimină local" disabled={busy} onPress={() => onDiscard(entry.id)} />
        </View>}
      </View>)}
    </View>
    {!!board.paperwork?.length && <View style={s.card}><Text style={s.heading}>Primite de firmă · {board.paperwork.length}</Text>
      {board.paperwork.slice(-12).reverse().map(file => <View key={file.id} style={s.row}><Text style={s.text}>{file.kind.toUpperCase()} · {Object.values(board.trips).flat().find(t => t.id === file.tripId)?.title ?? "Cursă"}</Text><Text style={s.good}>Înregistrat · {new Date(file.createdAt).toLocaleDateString("ro-RO")}</Text></View>)}
    </View>}
  </>;
}
function Action({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} style={[s.action, disabled && { opacity: .4 }]} onPress={onPress}><Text style={s.text}>{label}</Text></Pressable>;
}
export function DocumentPreview({ entry, busy, onClose, onSend, onRetake }: { entry: WorkEntry | null; busy: boolean; onClose: () => void; onSend: () => void; onRetake: () => void }) {
  if (!entry || entry.type !== "file") return null;
  const file = workFile(entry.fileName);
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.preview}>
    <Text style={s.heading}>{entry.kind.toUpperCase()} · verifică fotografia</Text><Text style={s.text}>{entry.title}</Text>
    {file.exists ? <Image accessibilityLabel="Previzualizare document" source={{ uri: file.uri }} resizeMode="contain" style={s.photo} /> : <Text style={s.warn}>Fotografia nu mai este disponibilă pe acest telefon.</Text>}
    <Text style={s.muted}>Se văd toate marginile, textul și semnăturile? Pentru mai multe pagini, adaugă câte o fotografie.</Text>
    {entry.status === "draft" && <><Pressable accessibilityRole="button" disabled={busy || !file.exists} style={[s.primary, (busy || !file.exists) && { opacity: .4 }]} onPress={onSend}><Text style={s.primaryText}>Trimite {entry.kind.toUpperCase()}</Text></Pressable><Action label="Refă fotografia" disabled={busy} onPress={onRetake} /></>}
    <Action label={entry.status === "draft" ? "Păstrează pentru mai târziu" : "Închide"} onPress={onClose} />
    <Text style={s.muted}>{statusLabel[entry.status]}{entry.status === "draft" ? ". Se păstrează pe telefon până alegi să trimiți sau să elimini." : "."}</Text>
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#0a1220" }, card: { backgroundColor: "#142137", borderColor: "#253853", borderWidth: 1, padding: 18, borderRadius: 22, gap: 12 }, heading: { color: "#f5f7fc", fontSize: 21, fontWeight: "700" }, text: { color: "#eef4ff", fontSize: 15, lineHeight: 23 }, muted: { color: "#aabbd1", fontSize: 14, lineHeight: 22 }, good: { color: "#80e2c2", fontSize: 14 }, warn: { color: "#f6cb86", fontSize: 14, lineHeight: 21 }, row: { paddingTop: 14, borderTopWidth: 1, borderColor: "#30445e", gap: 8 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, action: { backgroundColor: "#22364e", padding: 13, minHeight: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" }, preview: { padding: 20, gap: 16, maxWidth: 680, width: "100%", alignSelf: "center" }, photo: { width: "100%", height: 360, backgroundColor: "#142137", borderRadius: 16 }, primary: { backgroundColor: "#80e2c2", borderRadius: 14, minHeight: 54, padding: 16, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#09241c", fontSize: 16, fontWeight: "700" } });
