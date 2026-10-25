import { Image, Modal, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { WorkEntry } from "../work-queue";
import { workFile } from "../work-storage";
import { C } from "../theme";
import { useT } from "../i18n";
import { Btn, T } from "./kit";
export function DocumentPreview({ entry, busy, onClose, onSend, onRetake }: { entry: WorkEntry | null; busy: boolean; onClose: () => void; onSend: () => void; onRetake: () => void }) {
  const { t } = useT();
  if (!entry || entry.type !== "file") return null;
  const file = workFile(entry.fileName), kind = entry.kind.toUpperCase();
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.body}>
    <T w="semi" style={{ fontSize: 24, lineHeight: 30 }}>{`${kind} · ${t("verifică fotografia|check the photo|sprawdź zdjęcie")}`}</T>
    <T style={{ color: C.fg2 }}>{entry.title}</T>
    {file.exists ? <Image accessibilityLabel={t("Previzualizare document|Document preview|Podgląd dokumentu")} source={{ uri: file.uri }} resizeMode="contain" style={s.photo} />
      : <T style={{ color: C.warn }}>{t("Fotografia nu mai este pe acest telefon.|The photo is no longer on this phone.|Zdjęcia nie ma już w telefonie.")}</T>}
    <T style={{ color: C.fg2, fontSize: 14 }}>{t("Se văd toate marginile, textul și semnăturile? Pentru mai multe pagini, adaugă câte o fotografie.|Are all edges, text and signatures visible? For more pages, add one photo each.|Czy widać wszystkie krawędzie, tekst i podpisy? Każdą stronę dodaj osobnym zdjęciem.")}</T>
    {entry.status === "draft" ? <>
      <Btn style={{ alignSelf: "stretch" }} disabled={busy || !file.exists} label={`${t("Trimite|Send|Wyślij")} ${kind}`} onPress={onSend} />
      <Btn kind="sec" style={{ alignSelf: "stretch" }} disabled={busy} label={t("Refă fotografia|Retake photo|Zrób ponownie")} onPress={onRetake} />
    </> : null}
    <Btn kind="ghost" style={{ alignSelf: "stretch" }} label={t(entry.status === "draft" ? "Păstrează pentru mai târziu|Keep for later|Zachowaj na później" : "Închide|Close|Zamknij")} onPress={onClose} />
    {entry.status === "draft" ? <T style={{ color: C.fg3, fontSize: 13 }}>{t("Rămâne pe telefon până o trimiți sau o elimini.|It stays on the phone until you send or remove it.|Zostaje w telefonie, dopóki jej nie wyślesz lub nie usuniesz.")}</T> : null}
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.bg }, body: { padding: 20, gap: 14, maxWidth: 680, width: "100%", alignSelf: "center" }, photo: { width: "100%", height: 380, backgroundColor: C.bg2, borderRadius: 16 } });
