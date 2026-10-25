// Fixed shift bar above the tabs, same as the web DriverShiftBar: Start/End shift + one-tap Private with a 4 s undo.
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { C, mix } from "../theme";
import { useT } from "../i18n";
import { Btn, Icon, T } from "./kit";

export type ShiftState = "off" | "on" | "priv";
export const SHIFT_CHECKS = [
  ["chk.tyres", "Anvelope și lumini|Tyres and lights|Opony i światła"],
  ["chk.fluids", "Ulei, AdBlue, lichide|Oil, AdBlue, fluids|Olej, AdBlue, płyny"],
  ["chk.docs", "Documente la bord (CMR, RCA)|Documents on board (CMR, insurance)|Dokumenty w kabinie (CMR, OC)"],
  ["chk.damage", "Fără daune noi pe caroserie|No new body damage|Brak nowych uszkodzeń nadwozia"],
] as const;
export const MIN_SHIFT_CHECKS = 3;
export const PRIV_UNDO_MS = 4000;
export const elapsed = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000)), h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm} min`;
};

export function ShiftBar({ state, start, plate, busy, blocked, offSub, gpsNote, msg, onStart, onStop, onPrivate }: {
  state: ShiftState; start?: string | null; plate: string; busy: boolean; blocked?: boolean; offSub: string; gpsNote?: string; msg?: string;
  onStart: (checks: string[]) => Promise<boolean>; onStop: () => Promise<boolean>; onPrivate: (on: boolean) => Promise<boolean>;
}) {
  const { t } = useT();
  const [now, setNow] = useState(Date.now());
  const [ask, setAsk] = useState<"start" | "stop" | null>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const [undo, setUndo] = useState<boolean | null>(null);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { if (undo === null) return; const i = setTimeout(() => setUndo(null), PRIV_UNDO_MS); return () => clearTimeout(i); }, [undo]);
  useEffect(() => { if (state === "off") setUndo(null); }, [state]);
  const t0 = start ? Date.parse(start) : NaN;
  const sub = state === "off" ? offSub : state === "priv" ? t("Privat · fără poziție|Private · no location|Bez lokalizacji")
    : gpsNote || `${t("În tură|On shift|Na zmianie")}${Number.isNaN(t0) ? "" : ` ${elapsed(now - t0)}`}`;
  const go = state === "off";
  const goColor = go ? C.pos : C.neg, goInk = go ? C.posInk : "#fff";
  async function priv(fromUndo = false) {
    const next = state !== "priv";
    if (await onPrivate(next)) setUndo(fromUndo ? null : next);
  }
  const barBg = state === "on" ? mix(C.pos, 7, C.bg) : state === "priv" ? mix(C.priv, 9, C.bg) : C.bg;
  return <View style={[st.bar, { backgroundColor: barBg }]} accessibilityLabel={t("Tura|Shift|Zmiana")}>
    {undo !== null && state !== "off" ? <View style={st.undo} accessibilityLiveRegion="polite">
      <T style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>{undo ? t("Privat pornit · locația nu se mai trimite|Private on · location is not sent|Tryb prywatny włączony · lokalizacja nie jest wysyłana") : t("Privat oprit · locația se trimite din nou|Private off · location is sent again|Tryb prywatny wyłączony · lokalizacja znów wysyłana")}</T>
      <Pressable disabled={busy} onPress={() => { setUndo(null); void priv(true); }} style={st.undoB} accessibilityRole="button"><T w="semi" style={{ color: C.priv }}>{t("Anulează|Undo|Cofnij")}</T></Pressable>
    </View> : msg ? <View style={[st.undo, { backgroundColor: mix(C.neg, 16, C.bg2) }]} accessibilityLiveRegion="polite"><T style={{ fontSize: 14, lineHeight: 19 }}>{msg}</T></View> : null}
    <View style={st.row}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || (go && blocked), busy }} disabled={busy}
        onPress={() => { if (go && blocked) return; setChecks([]); setAsk(go ? "start" : "stop"); }}
        style={({ pressed }) => [st.go, { backgroundColor: goColor, opacity: go && blocked ? .5 : busy ? .7 : 1 }, pressed && { transform: [{ scale: .98 }] }]}>
        <View style={[st.ic, { backgroundColor: go ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.18)" }]}><Icon name={go ? "play" : "pause"} size={20} color={goInk} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="bold" lines={1} style={{ color: goInk, fontSize: 17, lineHeight: 21 }}>{go ? t("Pornește tura|Start shift|Start zmiany") : t("Termină tura|End shift|Koniec zmiany")}</T>
          <T lines={1} style={{ color: goInk, opacity: .85, fontSize: 12, lineHeight: 16 }}>{sub}</T>
        </View>
      </Pressable>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: state === "priv", disabled: go || busy }} disabled={go || busy} onPress={() => void priv()}
        accessibilityLabel={`${t("Privat|Private|Prywatnie")}: ${state === "priv" ? t("pornit|on|włączony") : t("oprit|off|wyłączony")}`}
        style={[st.priv, state === "priv" && { backgroundColor: C.priv, borderColor: C.priv }, go && { opacity: .4 }]}>
        <View style={[st.sw, state === "priv" && { backgroundColor: "rgba(22,11,51,0.35)" }]}><View style={[st.knob, state === "priv" && { left: 16, backgroundColor: "#fff" }]} /></View>
        <T w="semi" style={{ color: state === "priv" ? C.privInk : C.priv, fontSize: 14 }}>{t("Privat|Private|Prywatnie")}</T>
      </Pressable>
    </View>
    <Modal visible={!!ask} transparent animationType="slide" onRequestClose={() => setAsk(null)}>
      <Pressable style={st.sheetBg} onPress={() => setAsk(null)}>
        <Pressable style={st.sheet} onPress={() => undefined}>
          <View style={st.grab} />
          <View style={[st.qic, { backgroundColor: mix(ask === "start" ? C.pos : C.neg, 16, C.bg2) }]}><Icon name={ask === "start" ? "play" : "pause"} size={22} color={ask === "start" ? C.pos : C.neg} /></View>
          <T w="semi" style={{ fontSize: 22, lineHeight: 28 }}>{ask === "start" ? t("Pornești tura acum?|Start your shift now?|Zacząć zmianę teraz?") : t("Termini tura acum?|End your shift now?|Zakończyć zmianę teraz?")}</T>
          <T style={{ color: C.fg2, fontSize: 14 }}><T w="semi" style={{ fontSize: 14 }}>{plate}</T> · {ask === "start" ? `${t("Verificare|Check|Kontrola")} ${checks.length}/${SHIFT_CHECKS.length}` : Number.isNaN(t0) ? t("În tură|On shift|Na zmianie") : `${t("În tură de|On shift for|Na zmianie od")} ${elapsed(now - t0)}`}</T>
          <T style={{ color: C.fg2 }}>{ask === "start" ? t("Locația camionului se trimite firmei cât ești în tură. O poți opri oricând cu Privat.|The truck's location is shared with your company while you're on shift. Pause it anytime with Private.|Lokalizacja pojazdu jest wysyłana firmie w trakcie zmiany. Możesz ją wstrzymać przyciskiem Prywatnie.")
            : t("Se oprește trimiterea locației. Cursa rămâne deschisă până apeși „Am descărcat”.|Location sharing stops. The trip stays open until you tap “Unloaded”.|Wysyłanie lokalizacji zostanie zatrzymane. Kurs pozostaje otwarty do „Rozładowano”.")}</T>
          {ask === "start" && <View style={{ gap: 8 }}>
            <T w="semi" style={{ fontSize: 14, color: C.fg2 }}>{t("Verificare înainte de plecare · minim 3 din 4|Pre-trip check · at least 3 of 4|Kontrola przed wyjazdem · min. 3 z 4")}</T>
            {SHIFT_CHECKS.map(([key, label]) => { const on = checks.includes(key); return <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              onPress={() => setChecks(c => on ? c.filter(x => x !== key) : [...c, key])} style={[st.chk, on && { borderColor: mix(C.pos, 55, C.bg), backgroundColor: mix(C.pos, 10, C.bg2) }]}>
              <View style={[st.box, on && { backgroundColor: C.pos, borderColor: C.pos }]}>{on ? <Icon name="check" size={16} color={C.posInk} /> : null}</View>
              <T style={{ flex: 1 }}>{t(label)}</T>
            </Pressable>; })}
          </View>}
          <Btn kind={ask === "start" ? "pri" : "danger"} style={[{ alignSelf: "stretch" }, ask === "start" && { backgroundColor: C.pos }]} disabled={busy || (ask === "start" && checks.length < MIN_SHIFT_CHECKS)}
            label={ask === "start" ? t("Da, pornește tura|Yes, start shift|Tak, zacznij zmianę") : t("Da, termină tura|Yes, end shift|Tak, zakończ zmianę")}
            onPress={async () => { const k = ask; if (!k) return; const ok = k === "start" ? await onStart(checks) : await onStop(); if (ok) setAsk(null); }} />
          <Btn kind="sec" style={{ alignSelf: "stretch" }} label={t("Anulează|Cancel|Anuluj")} onPress={() => setAsk(null)} />
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}
const st = StyleSheet.create({
  bar: { borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 8 },
  row: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  go: { flex: 1, minHeight: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, paddingVertical: 8 },
  ic: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  priv: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: mix(C.priv, 45, C.bg), backgroundColor: mix(C.priv, 10, C.bg) },
  sw: { width: 34, height: 20, borderRadius: 10, backgroundColor: mix(C.priv, 28, C.bg) },
  knob: { position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: C.priv },
  undo: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 4, borderRadius: 14, backgroundColor: mix(C.priv, 18, C.bg2), minHeight: 48 },
  undoB: { minHeight: 40, paddingHorizontal: 14, justifyContent: "center", borderRadius: 10 },
  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34, gap: 12, borderWidth: 1, borderColor: C.line },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.fg3, marginBottom: 6 },
  qic: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  chk: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.fg3, alignItems: "center", justifyContent: "center" },
});
