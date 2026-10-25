import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import * as Haptics from "expo-haptics";
import { C, F, mix } from "../theme";

export type Segment = { key: string; label: string; count: number; page: ReactNode };
/** Vertical scroll offset per page, kept while the app runs (back from a trip returns to the same spot). */
export type PagerMemo = { y: Record<string, number> };
const native = Platform.OS !== "web";
function tick() { if (native) void Haptics.selectionAsync().catch(() => {}); }

/** Segmented control pinned on top + horizontally swipeable pages, each with its own vertical scroll. */
export function SegmentPager({ segments, index, onIndex, memo, label }: { segments: Segment[]; index: number; onIndex: (i: number) => void; memo: PagerMemo; label: string }) {
  const [w, setW] = useState(0), [barW, setBarW] = useState(0);
  const pager = useRef<ScrollViewInstance>(null), x = useRef(new Animated.Value(0)).current;
  const cur = useRef(index), target = useRef<number | null>(null), laidOut = useRef(0);
  const n = segments.length, segW = barW ? (barW - 8) / n : 0, compact = segW > 0 && segW < 128;
  const go = (i: number, animated = true) => { if (!w) return; target.current = animated ? i : null; pager.current?.scrollTo({ x: i * w, animated }); if (!animated) x.setValue(i * w); };
  // first layout / rotation: jump to the active page without animation
  useEffect(() => { if (w && laidOut.current !== w) { laidOut.current = w; go(cur.current, false); } });
  // the parent changed the segment (e.g. an empty-state shortcut)
  useEffect(() => { if (index !== cur.current) { cur.current = index; go(index); tick(); } }, [index]);
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
    useNativeDriver: native,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!w) return;
      const i = Math.max(0, Math.min(n - 1, Math.round(e.nativeEvent.contentOffset.x / w)));
      if (target.current != null) { if (i === target.current && Math.abs(e.nativeEvent.contentOffset.x - i * w) < 2) target.current = null; return; }
      if (i !== cur.current) { cur.current = i; onIndex(i); tick(); }
    },
  });
  const press = (i: number) => { if (i === cur.current) return; cur.current = i; onIndex(i); tick(); go(i); };
  const shift = w && segW ? x.interpolate({ inputRange: [0, w * (n - 1)], outputRange: [0, segW * (n - 1)], extrapolate: "clamp" }) : 0;
  return <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}>
    <View style={st.barWrap}>
      <View accessibilityRole="tablist" accessibilityLabel={label} style={st.bar} onLayout={e => setBarW(e.nativeEvent.layout.width)}>
        {segW ? <Animated.View pointerEvents="none" style={[st.thumb, { width: segW, transform: [{ translateX: shift }] }]} /> : null}
        {segments.map((sg, i) => {
          const on = i === index;
          return <Pressable key={sg.key} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} accessibilityLabel={`${sg.label}, ${sg.count}`} onPress={() => press(i)}
            style={({ pressed }) => [st.seg, compact && st.segCompact, pressed && { opacity: .7 }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85} style={[st.label, compact && { fontSize: segW < 100 ? 12 : 13, lineHeight: 16 }, { color: on ? C.fg : C.fg2 }]}>{sg.label}</Text>
            <View style={[st.count, on && st.countOn, compact && st.countCompact]}><Text style={[st.countT, { color: on ? "#fff" : C.fg2 }, compact && { fontSize: 11, lineHeight: 16 }]}>{sg.count}</Text></View>
          </Pressable>;
        })}
      </View>
    </View>
    <Animated.ScrollView ref={pager} horizontal pagingEnabled bounces={false} overScrollMode="never" showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
      {w ? segments.map(sg => <ScrollView key={sg.key} style={{ width: w }} contentContainerStyle={st.page} contentOffset={{ x: 0, y: memo.y[sg.key] ?? 0 }} scrollEventThrottle={64}
        onScroll={e => { memo.y[sg.key] = e.nativeEvent.contentOffset.y; }} keyboardShouldPersistTaps="handled" accessibilityLabel={sg.label}>
        {sg.page}
      </ScrollView>) : null}
    </Animated.ScrollView>
  </View>;
}
const st = StyleSheet.create({
  barWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  bar: { flexDirection: "row", padding: 4, borderRadius: 16, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, width: "100%", maxWidth: 680, alignSelf: "center" },
  thumb: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: C.bg3, borderWidth: 1, borderColor: mix(C.acc, 55, C.bg3) },
  seg: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6, borderRadius: 12 },
  segCompact: { flexDirection: "column", gap: 2, minHeight: 50, paddingVertical: 5, paddingHorizontal: 2 },
  label: { fontFamily: F.semi, fontSize: 14, lineHeight: 18, flexShrink: 1, textAlign: "center" },
  count: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" },
  countOn: { backgroundColor: C.accBtn },
  countCompact: { minWidth: 20, height: 16, paddingHorizontal: 5, borderRadius: 8 },
  countT: { fontFamily: F.semi, fontSize: 12, lineHeight: 16 },
  page: { padding: 20, paddingBottom: 32, gap: 14, width: "100%", maxWidth: 680, alignSelf: "center" },
});
