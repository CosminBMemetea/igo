import { Pressable, StyleSheet, View } from "react-native";
import { C, mix } from "../theme";
import { useT } from "../i18n";
import { Icon, T } from "./kit";
export type Page = "today" | "trips" | "documents" | "account";
const TABS: [Page, "home" | "trips" | "docs" | "user", string][] = [["today", "home", "Acasă|Home|Start"], ["trips", "trips", "Curse|Trips|Kursy"], ["documents", "docs", "Acte|Documents|Dokumenty"], ["account", "user", "Profil|Profile|Profil"]];
export function TabBar({ page, onPage, badge, bottom }: { page: Page; onPage: (p: Page) => void; badge: number; bottom: number }) {
  const { t } = useT();
  return <View accessibilityRole="tablist" style={[s.bar, { paddingBottom: Math.max(bottom, 8) }]}>{TABS.map(([key, icon, label]) => {
    const on = page === key, color = on ? C.acc : C.fg2;
    return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t(label) + (key === "documents" && badge ? `, ${badge}` : "")} onPress={() => onPage(key)} style={[s.tab, on && { backgroundColor: mix(C.acc, 12, C.bg) }]}>
      <View><Icon name={icon} size={22} color={color} />{key === "documents" && badge ? <View style={s.badge}><T w="bold" style={{ color: "#fff", fontSize: 11, lineHeight: 15 }}>{badge > 9 ? "9+" : badge}</T></View> : null}</View>
      <T w={on ? "semi" : "medium"} style={{ color, fontSize: 12, lineHeight: 16 }}>{t(label)}</T>
    </Pressable>;
  })}</View>;
}
const s = StyleSheet.create({
  bar: { flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingTop: 6, backgroundColor: "rgba(11,11,12,0.96)", borderTopWidth: 1, borderColor: C.line },
  tab: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 4 },
  badge: { position: "absolute", top: -5, right: -12, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.neg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.bg },
});
