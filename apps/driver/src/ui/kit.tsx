import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { C, F, mix } from "../theme";
import { useT } from "../i18n";
import { CHECK_LABEL, routeStops, type CheckItem, type CheckState } from "../checklist";

/** Icons drawn from the same SVG paths as the web src/components/icons.tsx. */
const PATHS: Record<string, ReactNode> = {
  home: <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  trips: <><Circle cx="6" cy="18" r="2" /><Circle cx="18" cy="6" r="2" /><Path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>,
  docs: <><Path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><Path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21a8 8 0 0 1 16 0" /></>,
  pause: <Path d="M8 5v14M16 5v14" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  back: <Path d="M15 5l-7 7 7 7" />,
  sync: <Path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18 3v4.5h-4.5M6 21v-4.5h4.5" />,
  pin: <><Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><Circle cx="12" cy="9.5" r="2.5" /></>,
};
export function Icon({ name, size = 24, color = C.fg2 }: { name: keyof typeof PATHS | "play"; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {name === "play" ? <Path d="M7 5l12 7-12 7z" fill={color} /> : PATHS[name]}
  </Svg>;
}
export function T({ children, style, w = "regular", lines }: { children: ReactNode; style?: StyleProp<TextStyle>; w?: keyof typeof F; lines?: number }) {
  return <Text numberOfLines={lines} style={[{ color: C.fg, fontFamily: F[w], fontSize: 15, lineHeight: 22 }, style]}>{children}</Text>;
}
type Kind = "pri" | "sec" | "doc" | "ghost" | "danger";
export function Btn({ label, onPress, kind = "pri", disabled, icon, style }: { label: string; onPress: () => void; kind?: Kind; disabled?: boolean; icon?: string; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.btn, s[kind], disabled && { opacity: .45 }, pressed && !disabled && { transform: [{ scale: .97 }] }, style]}>
    {icon ? <T style={{ fontSize: 18 }}>{icon}</T> : null}
    <T w="semi" style={[{ fontSize: 16, textAlign: "center", flexShrink: 1 }, kind === "pri" && { color: "#fff" }]}>{label}</T>
  </Pressable>;
}
export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return <View style={{ marginTop: 22, gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <T w="semi" style={s.secH}>{title}</T>
      {count != null && <View style={s.secN}><T w="semi" style={{ fontSize: 12, lineHeight: 24 }}>{count}</T></View>}
    </View>
    {children}
  </View>;
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Badge({ label, tone }: { label: string; tone?: "ok" | "warn" | "bad" | "" }) {
  const color = tone === "ok" ? C.pos : tone === "warn" ? C.warn : tone === "bad" ? C.neg : C.fg2;
  return <View style={[s.badge, { backgroundColor: tone ? mix(color, 14, C.bg2) : C.bg3 }]}><T w="medium" style={{ color, fontSize: 12, lineHeight: 16 }}>{label}</T></View>;
}
/** From → To timeline (web .driver-route). */
export function TripRoute({ title, big }: { title: string; big?: boolean }) {
  const { t } = useT();
  const stops = routeStops(title);
  if (stops.length < 2) return <T w="semi" style={{ fontSize: big ? 26 : 18, lineHeight: big ? 32 : 25 }}>{title}</T>;
  return <View style={{ paddingVertical: 4 }}>{stops.map((stop, i) => {
    const last = i === stops.length - 1;
    return <View key={i} style={{ flexDirection: "row", gap: 12, paddingBottom: last ? 0 : 18 }}>
      <View style={{ width: 14, alignItems: "center" }}>
        <View style={[s.dot, last && { borderRadius: 3, backgroundColor: C.acc }]} />
        {!last && <Dash />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={{ color: C.fg2, fontSize: 12, lineHeight: 17, marginBottom: 2 }}>{t(i === 0 ? "Plecare|From|Wyjazd" : last ? "Destinație|To|Cel" : "Pe traseu|Via|Przez")}</T>
        <T w="semi" style={{ fontSize: big ? 27 : 20, lineHeight: big ? 34 : 26 }}>{stop}</T>
      </View>
    </View>;
  })}</View>;
}
/** Dashed connector built from segments: Android ignores one-sided dashed borders. */
function Dash() {
  return <View style={{ flex: 1, overflow: "hidden", alignItems: "center", marginTop: 4, gap: 3 }}>{Array.from({ length: 12 }, (_, i) => <View key={i} style={{ width: 1, height: 4, backgroundColor: C.fg3 }} />)}</View>;
}
const CHIP: Record<CheckState, { color: string; icon: string; bg: string }> = {
  done: { color: C.pos, icon: "✓", bg: mix(C.pos, 12, C.bg2) }, todo: { color: C.warn, icon: "!", bg: mix(C.warn, 13, C.bg2) },
  missing: { color: C.neg, icon: "!", bg: mix(C.neg, 13, C.bg2) }, later: { color: C.fg2, icon: "·", bg: C.bg3 },
};
export function Chips({ items }: { items: CheckItem[] }) {
  const { t } = useT();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{items.map(c => {
    const k = CHIP[c.state];
    return <View key={c.key} accessibilityLabel={`${t(CHECK_LABEL[c.key])}: ${t(c.state === "done" ? "gata|done|gotowe" : c.state === "missing" ? "lipsește|missing|brak" : c.state === "todo" ? "de făcut|to do|do zrobienia" : "mai târziu|later|później")}`}
      style={[s.chip, { backgroundColor: k.bg, opacity: c.state === "later" ? .75 : 1 }]}>
      <View style={[s.chipI, { backgroundColor: c.state === "later" ? C.fg3 : k.color }]}><T w="bold" style={{ fontSize: 11, lineHeight: 14, color: c.state === "missing" ? "#fff" : C.bg }}>{k.icon}</T></View>
      <T w={c.state === "missing" ? "semi" : "regular"} style={{ color: k.color, fontSize: 13, lineHeight: 18 }}>{t(CHECK_LABEL[c.key])}</T>
    </View>;
  })}</View>;
}
export function Note({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "bad" | "ok" | "info" }) {
  const color = tone === "warn" ? C.warn : tone === "bad" ? C.neg : tone === "ok" ? C.pos : C.acc;
  return <View style={[s.note, { backgroundColor: mix(color, 12, C.bg2), borderColor: mix(color, 40, C.bg) }]}><T style={{ fontSize: 14, lineHeight: 20 }}>{children}</T></View>;
}
export const s = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, alignSelf: "flex-start", maxWidth: "100%" },
  pri: { backgroundColor: C.accBtn },
  sec: { backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line },
  doc: { backgroundColor: mix(C.neg, 14, C.bg), borderWidth: 1, borderColor: mix(C.neg, 45, "#3a3a3e") },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.line },
  danger: { backgroundColor: mix(C.neg, 20, C.bg2), borderWidth: 1, borderColor: mix(C.neg, 50, C.bg) },
  secH: { color: C.fg2, fontSize: 15, letterSpacing: .9, textTransform: "uppercase" },
  secN: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: C.bg3, alignItems: "center" },
  card: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 18, gap: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  dot: { width: 11, height: 11, borderWidth: 2, borderColor: C.acc, borderRadius: 6, marginTop: 5 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingLeft: 6, paddingRight: 10, borderRadius: 999 },
  chipI: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  note: { borderRadius: 12, borderWidth: 1, padding: 12 },
});
