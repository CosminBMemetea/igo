import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import * as Haptics from "expo-haptics";
import { alignOffset, pageAt } from "./pager";
import { C, F, mix } from "../theme";

export type Segment = { key: string; label: string; count: number; page: ReactNode };
/** Vertical scroll offset per page, kept while the app runs (back from a trip returns to the same spot). */
export type PagerMemo = { y: Record<string, number> };
const native = Platform.OS !== "web";
function tick() { if (native) void Haptics.selectionAsync().catch(() => {}); }

/**
 * Segmented control pinned on top + horizontally swipeable pages, each with its own vertical scroll.
 * The thumb and the highlighted tab come only from the pager's real offset (onScroll), so they can never
 * disagree with the visible page. Jumps to the active page wait until width and content width are known,
 * are re-checked on layout/content/width/index changes, and retried until the reported offset matches.
 */
export function SegmentPager({ segments, index, onIndex, memo, label }: { segments: Segment[]; index: number; onIndex: (i: number) => void; memo: PagerMemo; label: string }) {
  const [w, setW] = useState(0), [barW, setBarW] = useState(0), [shown, setShown] = useState(0), [ready, setReady] = useState(false);
  const pager = useRef<ScrollViewInstance>(null), x = useRef(new Animated.Value(0)).current;
  const n = segments.length, segW = barW ? (barW - 8) / n : 0, compact = segW > 0 && segW < 128;
  const r = useRef({ w: 0, n, contentW: 0, x: 0, cur: index, target: null as number | null, busy: false, aligning: null as number | null, onIndex, timers: [] as ReturnType<typeof setTimeout>[] }).current;
  r.n = n; r.onIndex = onIndex;
  const later = (ms: number, f: () => void) => { r.timers.push(setTimeout(f, ms)); };
  useEffect(() => () => { r.timers.forEach(clearTimeout); }, [r]);
  /** Jump (no animation) to the active page if the real offset is elsewhere. Idempotent; safe to call often. */
  const align = () => {
    const tx = alignOffset({ w: r.w, contentW: r.contentW, n: r.n, x: r.x, want: r.cur, busy: r.busy || r.target != null });
    if (tx == null) { if (r.w && r.contentW >= r.w * r.n - 1 && pageAt(r.x, r.w, r.n) === r.cur) setReady(true); return; }
    r.aligning = tx; pager.current?.scrollTo({ x: tx, y: 0, animated: false });
    later(300, () => { if (r.aligning === tx) r.aligning = null; });
  };
  const settle = () => { for (const ms of [0, 50, 150, 400, 900]) later(ms, align); later(700, () => setReady(true)); };
  // width known / changed (first layout, rotation, split screen) or a different number of pages
  useEffect(() => { r.w = w; if (w) settle(); }, [w, n]);
  // the parent changed the segment (empty-state shortcut, counts changed)
  useEffect(() => {
    if (index === r.cur) return;
    r.cur = index;
    if (!r.w || !ready) { settle(); return; }
    r.target = index; pager.current?.scrollTo({ x: index * r.w, y: 0, animated: true }); tick();
    later(700, () => { if (r.target === index) r.target = null; align(); });
  }, [index]);
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
    useNativeDriver: native,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const ox = e.nativeEvent.contentOffset.x; r.x = ox;
      if (!r.w) return;
      const i = pageAt(ox, r.w, r.n); setShown(i);
      if (r.aligning != null) { if (Math.abs(ox - r.aligning) < 2) { r.aligning = null; if (i === r.cur) setReady(true); } return; }
      if (r.target != null) { if (i === r.target && Math.abs(ox - i * r.w) < 2) r.target = null; return; }
      if (i !== r.cur) { r.cur = i; r.onIndex(i); tick(); }
    },
  });
  const press = (i: number) => { if (i === r.cur) return; r.cur = i; onIndex(i); tick(); if (!r.w) return; r.target = i; pager.current?.scrollTo({ x: i * r.w, y: 0, animated: true }); later(700, () => { if (r.target === i) r.target = null; align(); }); };
  const endDrag = () => { later(350, () => { if (r.busy) { r.busy = false; align(); } }); };
  const shift = w && segW ? x.interpolate({ inputRange: [0, Math.max(1, w * (n - 1))], outputRange: [0, segW * (n - 1)], extrapolate: "clamp" }) : 0;
  const active = ready ? shown : index;
  return <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}>
    <View style={st.barWrap}>
      <View accessibilityRole="tablist" accessibilityLabel={label} style={st.bar} onLayout={e => setBarW(e.nativeEvent.layout.width)}>
        {segW ? <Animated.View pointerEvents="none" style={[st.thumb, { width: segW, opacity: ready ? 1 : 0, transform: [{ translateX: shift }] }]} /> : null}
        {segments.map((sg, i) => {
          const on = i === active;
          return <Pressable key={sg.key} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} accessibilityLabel={`${sg.label}, ${sg.count}`} onPress={() => press(i)}
            style={({ pressed }) => [st.seg, compact && st.segCompact, pressed && { opacity: .7 }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85} style={[st.label, compact && { fontSize: segW < 100 ? 12 : 13, lineHeight: 16 }, { color: on ? C.fg : C.fg2 }]}>{sg.label}</Text>
            <View style={[st.count, on && st.countOn, compact && st.countCompact]}><Text style={[st.countT, { color: on ? "#fff" : C.fg2 }, compact && { fontSize: 11, lineHeight: 16 }]}>{sg.count}</Text></View>
          </Pressable>;
        })}
      </View>
    </View>
    <Animated.ScrollView ref={pager} horizontal pagingEnabled bounces={false} overScrollMode="never" showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll} keyboardShouldPersistTaps="handled"
      onContentSizeChange={(cw: number) => { r.contentW = cw; align(); }} onLayout={() => align()}
      onScrollBeginDrag={() => { r.busy = true; r.target = null; r.aligning = null; }} onScrollEndDrag={endDrag}
      onMomentumScrollEnd={() => { r.busy = false; align(); }} style={{ flex: 1, opacity: ready ? 1 : 0 }}>
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
