"use client";
// Querra Fleet: REPLAY tură/cursă — camion animat (60fps) pe geometria reală, dâră în urmă, restul traseului estompat.
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { fmtDate, fmtNum, type Locale } from "@/lib/i18n";
import type { ReplayData, ReplayEvent, RKind } from "@/lib/replay";
import { Icon } from "./icons";

const tileUrl = (theme: string, layer: "Base" | "Reference") => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${theme === "light" ? "Light" : "Dark"}_Gray_${layer}/MapServer/tile/{z}/{y}/{x}`;
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
const SPEEDS = [1, 4, 16] as const;
const BASE = 6; // minute simulate pe secundă la 1x
const EV_COL: Record<RKind, string> = { start: "var(--pos)", fuel: "#f5a524", pause: "var(--fg2)", private: "#a78bfa", end: "var(--fg)" };

// camion văzut de sus, cu botul în sus (nord) — rotit după direcție
const TRUCK = `<svg viewBox="0 0 40 72" width="26" height="47" aria-hidden="true">
  <defs><linearGradient id="rtc" x1="0" x2="1"><stop offset="0" stop-color="#e9ecf2"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#d5d9e2"/></linearGradient>
  <linearGradient id="rtt" x1="0" x2="1"><stop offset="0" stop-color="#c9ced8"/><stop offset=".5" stop-color="#f3f5f9"/><stop offset="1" stop-color="#bfc5d0"/></linearGradient></defs>
  <rect x="6" y="24" width="28" height="46" rx="3" fill="url(#rtt)" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
  <rect x="9" y="28" width="22" height="38" rx="1.5" fill="none" stroke="rgba(0,0,0,.08)"/>
  <rect x="17" y="19" width="6" height="6" fill="#30343c"/>
  <path d="M8 6c0-3 2.5-5 5.5-5h13c3 0 5.5 2 5.5 5v13c0 1.5-1 2.5-2.5 2.5h-19C9 21.5 8 20.5 8 19z" fill="url(#rtc)" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
  <path d="M10.5 4.5c1-1.6 2.4-2 4-2h11c1.6 0 3 .4 4 2l-1.2 4.2H11.7z" fill="#1d2433"/>
  <rect x="5" y="9" width="3" height="5" rx="1" fill="#30343c"/><rect x="32" y="9" width="3" height="5" rx="1" fill="#30343c"/>
  <rect x="11" y="1.2" width="4" height="1.6" rx=".8" fill="#fff6c8"/><rect x="25" y="1.2" width="4" height="1.6" rx=".8" fill="#fff6c8"/>
  <rect x="9" y="67.5" width="4" height="2" rx="1" fill="#ef4444"/><rect x="27" y="67.5" width="4" height="2" rx="1" fill="#ef4444"/>
</svg>`;

const x0near = (e: ReplayEvent, x: number) => x >= e.min - 6 && x <= (e.end ?? e.min) + 2;
export interface ReplayExtra { normal: number | null; profit: number | null; tank: number | null }
export interface ReplayProps { data: ReplayData; theme: "dark" | "light"; loc: Locale; L: Record<string, string>; back: string; extra?: ReplayExtra; autoplay?: boolean }

export default function ReplayMap({ data: d, theme, loc, L: t, back, extra, autoplay = false }: ReplayProps) {
  const el = useRef<HTMLDivElement>(null);
  const m = useRef<{ L: typeof Leaflet; map: Leaflet.Map; truck: Leaflet.Marker; trail: Leaflet.Polyline; halo: Leaflet.Polyline; ghost: Leaflet.Marker } | null>(null);
  const [ready, setReady] = useState(false);
  const [min, setMin] = useState(d.start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const [follow, setFollow] = useState(false);
  const [sumX, setSumX] = useState(false);
  useEffect(() => { if (playing) setSumX(false); }, [playing]);
  const [hl, setHl] = useState(false); // „Momente cheie”: sare repede peste drumul drept, încetinește la evenimente
  const hlRef = useRef(false); hlRef.current = hl;
  const [toasts, setToasts] = useState<{ id: number; kind: RKind; text: string; place?: string }[]>([]);
  const [intro, setIntro] = useState(autoplay);
  const minRef = useRef(d.start), headRef = useRef<number | null>(null), lastIdx = useRef(-1);
  const priv = useMemo(() => d.events.filter((e) => e.kind === "private"), [d]);
  const fuels = useMemo(() => d.events.filter((e) => e.kind === "fuel"), [d]);

  // km(t): liniar pe porțiuni, cu accelerare/frânare (trapez) pe porțiunile lungi → mișcare și viteză fluide
  const kmAt = useCallback((x: number) => {
    const k = d.keys;
    if (x <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (x < k[i][0]) {
      const [m0, k0] = k[i - 1], [m1, k1] = k[i], D = m1 - m0, dk = k1 - k0, tt = x - m0;
      if (!dk || D <= 0) return k0;
      if (D < 10) return k0 + (dk * tt) / D;
      const r = Math.min(3, D / 3), vmax = dk / (D - r);
      if (tt < r) return k0 + (vmax * tt * tt) / (2 * r);
      if (tt > D - r) return k1 - (vmax * (D - tt) * (D - tt)) / (2 * r);
      return k0 + vmax * (tt - r / 2);
    }
    return k[k.length - 1][1];
  }, [d]);
  const idxAt = useCallback((km: number) => { const p = d.path; let lo = 0, hi = p.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (p[mid][2] <= km) lo = mid; else hi = mid - 1; } return lo; }, [d]);
  const posAt = useCallback((km: number): [number, number] => {
    const p = d.path, i = idxAt(km), a = p[i], b = p[Math.min(p.length - 1, i + 1)];
    const f = b[2] > a[2] ? Math.max(0, Math.min(1, (km - a[2]) / (b[2] - a[2]))) : 0;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }, [d, idxAt]);
  const privAt = useCallback((x: number) => priv.find((e) => x >= e.min && x < (e.end ?? e.min)), [priv]);

  // init hartă
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !el.current) return;
      const map = L.map(el.current, { zoomControl: false, attributionControl: true, preferCanvas: false });
      const base = L.tileLayer(tileUrl(theme, "Base"), { attribution: "Esri, HERE, Garmin, © OpenStreetMap contributors", maxZoom: 16, keepBuffer: 4 }).addTo(map);
      L.tileLayer(tileUrl(theme, "Reference"), { maxZoom: 16, opacity: 0.5, pane: "overlayPane" }).addTo(map);
      // așteptăm primele dale (max 4 s) înainte să arătăm harta și să pornim redarea — fără ecran gri
      const tilesReady = new Promise<void>((res) => {
        setTimeout(res, 5000); // plasă de siguranță
        // după re-măsurarea containerului (400 ms) Leaflet cere alte dale; așteptăm să se termine TOATE cele vizibile
        setTimeout(() => { if (dead) return; try { map.invalidateSize(); } catch {} const b = base as unknown as { isLoading?: () => boolean }; if (!b.isLoading?.()) res(); else base.once("load", () => res()); }, 450);
      });
      const all = d.path.map((p) => [p[0], p[1]] as [number, number]);
      const line = { lineCap: "round", lineJoin: "round", interactive: false, smoothFactor: 1 } as const;
      // traseul rămas: estompat; segmentele private: doar o legătură punctată, fără drum
      const segs: [number, number][][] = []; let cur: [number, number][] = [];
      for (let i = 0; i < d.path.length; i++) {
        if (i && priv.some((e) => d.path[i - 1][2] <= e.km + 0.001 && d.path[i][2] > e.km + 0.001 && d.path[i][2] - d.path[i - 1][2] > 0.01 && kmAt(e.end ?? e.min) >= d.path[i][2] - 0.05)) { segs.push(cur); cur = []; }
        cur.push(all[i]);
      }
      segs.push(cur);
      for (const s of segs) if (s.length > 1) L.polyline(s, { ...line, color: "#888", weight: 5, opacity: 1, className: "rp-dimline" }).addTo(map);
      // traseul colorat după viteză (verde ≥ 60 km/h, galben 35–60, roșu < 35) — fără porțiunile private
      for (let i = 1; i < d.keys.length; i++) {
        const [m0, k0] = d.keys[i - 1], [m1, k1] = d.keys[i]; if (k1 - k0 < 0.3 || m1 <= m0) continue;
        const v = ((k1 - k0) / (m1 - m0)) * 60;
        const pts = d.path.filter((pt) => pt[2] >= k0 - 0.01 && pt[2] <= k1 + 0.01).map((pt) => [pt[0], pt[1]] as [number, number]);
        if (pts.length > 1) L.polyline(pts, { ...line, color: v >= 60 ? "#22c55e" : v >= 35 ? "#eab308" : "#ef4444", weight: 5, opacity: 0.55, className: "rp-speedline" }).addTo(map);
      }
      const halo = L.polyline([], { ...line, color: "#3b82f6", weight: 14, opacity: 0.2, className: "rp-halo" }).addTo(map);
      const trail = L.polyline([], { ...line, color: "#3b82f6", weight: 4, opacity: 1, className: "rp-trail" }).addTo(map);
      for (const e of priv) {
        const a = posAt(e.km), b = posAt(kmAt(e.end ?? e.min) + 0.001);
        L.polyline([a, b], { ...line, color: "#a78bfa", weight: 3, opacity: 0.95, dashArray: "2 9" }).addTo(map);
        L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { interactive: false, icon: L.divIcon({ className: "rp-privtag", html: `<span>🔒 ${t.private}</span>`, iconSize: [0, 0] }) }).addTo(map);
      }
      for (const e of d.events) {
        if (e.kind === "private") continue;
        const at = posAt(e.km);
        const html = e.kind === "fuel" ? `<i class="rp-ev fuel"><svg viewBox="0 0 24 24"><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h12M8 8h4M15 9l3 2v6a1.5 1.5 0 0 0 3 0V8l-3-3"/></svg></i>` : e.kind === "pause" ? `<i class="rp-ev pause"><svg viewBox="0 0 24 24"><path d="M9 7v10M15 7v10"/></svg></i>` : `<i class="rp-ev ${e.kind}"></i>`;
        L.marker(at, { icon: L.divIcon({ className: "", html, iconSize: [26, 26], iconAnchor: e.kind === "pause" ? [4, 22] : [13, 13] }), zIndexOffset: e.kind === "fuel" ? 400 : 100 }).addTo(map).on("click", () => { setPlaying(false); seek(e.min); });
      }
      const truck = L.marker(posAt(d.keys[0]?.[1] ?? 0), { icon: L.divIcon({ className: "rp-truck", html: `<div class="rt"><div class="rt-glow"></div>${TRUCK}</div>`, iconSize: [0, 0] }), zIndexOffset: 1000, keyboard: false, interactive: false }).addTo(map);
      const ghost = L.marker(posAt(d.keys[0]?.[1] ?? 0), { icon: L.divIcon({ className: "rp-ghost", html: `<span>🔒 ${t.privShort}</span>`, iconSize: [0, 0] }), interactive: false, opacity: 0 }).addTo(map);
      const mobile = matchMedia("(max-width:760px)").matches;
      map.fitBounds(L.latLngBounds(all).pad(0.12), { paddingTopLeft: mobile ? [16, 90] : [24, 90], paddingBottomRight: mobile ? [16, 330] : [420, 120], maxZoom: 14 });
      // QA: harta goală la prima încărcare — containerul își primește mărimea după init; re-măsurăm
      const inv = () => { if (!dead && (map as unknown as { _mapPane?: unknown })._mapPane) try { map.invalidateSize(); } catch {} }; requestAnimationFrame(inv); setTimeout(inv, 400);
      if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(() => { if (dead || !(map as unknown as { _mapPane?: unknown })._mapPane) { ro.disconnect(); return; } try { map.invalidateSize(); } catch {} }); ro.observe(el.current); map.on("unload", () => ro.disconnect()); }
      m.current = { L, map, truck, trail, halo, ghost };
      await tilesReady; if (dead) return;
      setReady(true);
      // intro cinematic: vedere de ansamblu → zbor la camion → camera urmărește → pornește redarea
      if (autoplay) {
        const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
        setTimeout(() => {
          if (dead) return;
          const go = () => { if (dead) return; setFollow(true); setIntro(false); window.dispatchEvent(new Event("qf-replay-play")); };
          if (calm) { map.setView(posAt(d.keys[0]?.[1] ?? 0), 10, { animate: false }); go(); return; }
          map.flyTo(posAt(d.keys[0]?.[1] ?? 0), 10, { duration: 1.8, easeLinearity: 0.2 }); map.once("moveend", go);
        }, 900);
      }
    })();
    return () => { dead = true; if (m.current) { try { const mp = m.current.map; mp.stop(); mp.off(); (mp as unknown as { _panAnim?: { stop(): void } })._panAnim?.stop(); mp.options.zoomAnimation = false; mp.remove(); } catch { /* demontare rapidă: animații Leaflet deja oprite */ } } m.current = null; };
  }, [d, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // vizibilitatea punctelor (fără porțiunile private) — calculată o dată
  const visible = useMemo(() => d.path.map((pt) => !priv.some((e) => pt[2] > e.km + 0.001 && pt[2] < kmAt(e.end ?? e.min) - 0.001)), [d, priv, kmAt]);
  const trailPts = useRef<[number, number][]>([]);
  const followRef = useRef(follow); followRef.current = follow;
  const fillRef = useRef<HTMLDivElement>(null), thumbRef = useRef<HTMLDivElement>(null), clockRef = useRef<HTMLDivElement>(null);

  // un cadru: poziție după DISTANȚĂ (km interpolați în timp), direcție netezită unghiular, dâră incrementală, cameră lină
  const draw = useCallback((x: number, dt = 0) => {
    const r = m.current; if (!r) return;
    const km = kmAt(x), p = posAt(km), pv = privAt(x);
    const el2 = r.truck.getElement();
    if (el2) el2.style.opacity = pv ? "0" : "1";
    r.ghost.setOpacity(pv ? 1 : 0);
    if (pv) r.ghost.setLatLng(posAt(pv.km));
    else r.truck.setLatLng(p); // Leaflet: translate3d → compus pe GPU
    // direcție: vector pe ±120 m de drum, în pixeli (corect pe Mercator); interpolare unghiulară dependentă de timp (fără salturi)
    const a = r.map.latLngToLayerPoint(posAt(Math.max(0, km - 0.12))), b = r.map.latLngToLayerPoint(posAt(km + 0.12));
    if (Math.hypot(b.x - a.x, b.y - a.y) > 0.5) {
      const target = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
      const h = headRef.current ?? target;
      const diff = ((target - h + 540) % 360) - 180;
      headRef.current = dt ? h + diff * (1 - Math.exp(-dt * 7)) : target;
    }
    const rt = el2?.querySelector<HTMLElement>(".rt");
    if (rt && headRef.current != null) rt.style.transform = `translate3d(-50%,-50%,0) rotate(${headRef.current.toFixed(2)}deg)`;
    // dâra: adăugăm doar punctele noi; reconstruim doar la derulare înapoi
    const i = idxAt(km), tp = trailPts.current;
    if (lastIdx.current >= 0 && tp.length) tp.pop(); // scoatem punctul curent anterior
    if (i < lastIdx.current || lastIdx.current < 0) { tp.length = 0; for (let j = 0; j <= i; j++) if (visible[j]) tp.push([d.path[j][0], d.path[j][1]]); }
    else for (let j = lastIdx.current + 1; j <= i; j++) if (visible[j]) tp.push([d.path[j][0], d.path[j][1]]);
    lastIdx.current = i;
    tp.push(pv ? tp[tp.length - 1] ?? p : p);
    r.trail.setLatLngs(tp); r.halo.setLatLngs(tp);
    // cameră: urmărire lină (amortizare exponențială în pixeli, panBy fără animație Leaflet)
    if (followRef.current && !pv) {
      const tgt = r.map.latLngToContainerPoint(p), size = r.map.getSize();
      const mobile = size.x < 760, cx = mobile ? size.x / 2 : (size.x - 420) / 2, cy = mobile ? size.y * 0.32 : size.y / 2;
      const dx = tgt.x - cx, dy = tgt.y - cy, k = dt ? 1 - Math.exp(-dt * 3.5) : 1;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) r.map.panBy([dx * k, dy * k], { animate: false });
    }
    // bara de timp: direct în DOM (fără re-render React la fiecare cadru)
    const pc = `${((x - d.start) / (d.end - d.start || 1)) * 100}%`;
    if (fillRef.current) fillRef.current.style.width = pc;
    if (thumbRef.current) thumbRef.current.style.left = pc;
    if (clockRef.current) clockRef.current.textContent = hhmm(x);
  }, [kmAt, posAt, privAt, idxAt, d, visible]);

  const seek = useCallback((x: number) => { minRef.current = Math.max(d.start, Math.min(d.end, x)); setMin(minRef.current); draw(minRef.current); }, [d, draw]);
  useEffect(() => { if (ready) draw(minRef.current); }, [ready, draw]);
  useEffect(() => { const r = m.current; if (!r || !ready) return; const f = () => draw(minRef.current); r.map.on("zoomend", f); return () => { r.map.off("zoomend", f); }; }, [ready, draw]);
  useEffect(() => { if (follow && ready) draw(minRef.current); }, [follow, ready, draw]);

  // bucla rAF: timp real → minute simulate; viteza de redare se schimbă lin (fără salt la 1×/4×/16×)
  const speedRef = useRef<number>(speed); speedRef.current = speed;
  const rateRef = useRef<number>(speed);
  useEffect(() => {
    if (!playing || !ready) return;
    let raf = 0, last = performance.now(), ui = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const tgt = hlRef.current ? (d.events.some((e) => e.kind !== "start" && x0near(e, minRef.current)) ? 2 : 28) : speedRef.current;
      rateRef.current += (tgt - rateRef.current) * (1 - Math.exp(-dt * 5));
      let x = minRef.current + dt * BASE * rateRef.current;
      // privat: trecem repede peste gol (nu e nimic de văzut)
      const pv = privAt(x); if (pv) x = Math.min(pv.end ?? x, x + dt * BASE * rateRef.current * 3);
      if (x >= d.end) { x = d.end; setPlaying(false); }
      minRef.current = x; draw(x, dt);
      if (now - ui > 160) { ui = now; setMin(x); }
      if (x < d.end) raf = requestAnimationFrame(step); else setMin(x);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, ready, d.end, d.events, draw, privAt]);
  useEffect(() => { const f = () => { setTimeout(() => { if (minRef.current >= d.end - 1) seek(d.start); setPlaying(true); }, 50); }; addEventListener("qf-replay-play", f); return () => removeEventListener("qf-replay-play", f); }, [d, seek]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") { e.preventDefault(); toggle(); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });
  const toggle = () => { if (!playing && minRef.current >= d.end - 1) seek(d.start); setPlaying((p) => !p); };

  // carduri pop-up când camionul ajunge la un eveniment (doar în redare, nu la derulare manuală)
  const lastToast = useRef(d.start - 1), tid = useRef(0);
  useEffect(() => {
    const prev = lastToast.current; lastToast.current = min;
    if (!playing || min < prev || min - prev > 30) return;
    const hit = d.events.filter((e) => e.min > prev && e.min <= min);
    if (!hit.length) return;
    const add = hit.map((e) => ({ id: ++tid.current, kind: e.kind, text: evLabel(e), place: e.place }));
    setToasts((x) => [...x, ...add].slice(-3));
    const ids = add.map((a) => a.id);
    setTimeout(() => setToasts((x) => x.filter((y) => !ids.includes(y.id))), 2800);
  }, [min, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // panou
  const km = kmAt(min), pv = privAt(min);
  const spd0 = pv ? null : Math.max(0, (kmAt(min + 0.25) - kmAt(min - 0.25)) * 120);
  // sub 3 km/h (pornire/oprire) afișăm 0 și „Oprit”, nu „În mers 1 km/h”
  const spd = spd0 != null && spd0 < 3 ? 0 : spd0;
  const usedL = (km * d.rate) / 100;
  const fueled = fuels.filter((e) => e.min <= min).reduce((a, e) => a + (e.litres ?? 0), 0);
  const curEv = d.events.find((e) => e.kind !== "private" && e.end != null && min >= e.min && min < e.end);
  const status = pv ? "private" : min >= d.end ? "end" : curEv?.kind === "fuel" ? "fuel" : curEv?.kind === "pause" || (spd ?? 0) < 1 ? "pause" : "drive";
  const N = (n: number, dd = 0) => fmtNum(loc, n, dd);
  // nivel rezervor estimat: plecare la ~55%, minus consum, plus alimentări
  const tankL = extra?.tank ?? 600, tankPct = Math.max(2, Math.min(100, ((tankL * 0.55 - usedL + fueled) / tankL) * 100));
  const pct = (x: number) => ((x - d.start) / (d.end - d.start || 1)) * 100;
  const evLabel = (e: ReplayEvent) => e.kind === "fuel" ? `${t.fuel}${e.litres ? ` · ${N(e.litres)} L` : ""}` : e.kind === "pause" ? `${t.pause} · ${N(Math.round((e.end ?? e.min) - e.min))} min` : e.kind === "private" ? `${t.private} · ${N(Math.round((e.end ?? e.min) - e.min))} min` : e.kind === "start" ? (e.day ? t.dayStart : t.start) : t.end;

  return (
    <div className="rp" data-status={status} data-ready={ready ? "1" : undefined}>
      <div ref={el} className="rp-map" />
      <div className="rp-top">
        <Link href={back} className="rp-back" aria-label={t.back}><svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" /></svg></Link>
        <div><div className="eyebrow">{t.title} · {fmtDate(loc, d.date, true)}</div><div className="rp-name">{d.plate}{d.route ? <span> · {d.route}</span> : null}</div></div>
        {d.demo ? <span className="badge acc">DEMO</span> : null}
      </div>
      <div className="rp-hud" aria-live="polite">
        <div className="rp-gauge">
          <svg viewBox="0 0 120 70" aria-hidden="true"><path d="M10 64a50 50 0 0 1 100 0" className="g-bg" /><path d="M10 64a50 50 0 0 1 100 0" className="g-fg" style={{ strokeDasharray: 157, strokeDashoffset: 157 - 157 * Math.min(1, (spd ?? 0) / 100) }} /></svg>
          <div className="g-val"><b className={spd == null ? "off" : ""}>{spd == null ? "–" : N(Math.round(spd))}</b><span>km/h</span></div>
        </div>
        <div className="rp-hudcol">
          <div className={`rp-status s-${status}`}><i />{t[`st_${status}`]}</div>
          <div className="rp-hudrow"><div><span>{t.time}</span><b>{hhmm(min)}</b></div><div><span>{t.km}</span><b>{N(km, km < 100 ? 1 : 0)}</b></div></div>
          <div className="rp-fuel"><span>{t.tank}</span><div className="fb"><i style={{ width: `${tankPct}%`, background: tankPct < 20 ? "#ef4444" : tankPct < 40 ? "#eab308" : "#22c55e" }} /></div><small>{N(tankPct)}%</small></div>
        </div>
      </div>
      <div className="rp-toasts">{toasts.map((x) => <div key={x.id} className={`rp-toast k-${x.kind}`}><i>{x.kind === "fuel" ? "⛽" : x.kind === "pause" ? "☕" : x.kind === "private" ? "🔒" : x.kind === "start" ? "🚚" : "🏁"}</i><div><b>{x.text}</b>{x.place ? <small>{x.place}</small> : null}</div></div>)}</div>
      {intro ? <div className="rp-intro"><span>{d.plate}</span><b>{d.route || t.title}</b></div> : null}
      {status === "end" && !playing && !sumX ? (<>
        <div className="rp-sumbg" onClick={() => setSumX(true)} />
        <div className="rp-sum" role="dialog" aria-label={t.sumTitle}>
          <button type="button" className="rp-sumx" onClick={() => setSumX(true)} aria-label="×">×</button>
          <div className="eyebrow">{t.sumTitle}</div>
          <h2>{d.route || d.plate}</h2>
          <div className="rp-sumgrid">
            <div><span>{t.km}</span><b>{N(d.km)}</b></div>
            <div><span>{t.hours}</span><b>{N(Math.floor((d.end - d.start) / 60))} h {String(Math.round((d.end - d.start) % 60)).padStart(2, "0")}</b></div>
            <div><span>L/100km</span><b>{N(d.rate, 1)}</b>{extra?.normal ? <small className={d.rate > extra.normal * 1.05 ? "neg" : "pos"}>{t.normal} {N(extra.normal, 1)}</small> : null}</div>
            <div><span>{t.profit}</span><b className={extra?.profit != null && extra.profit < 0 ? "neg" : ""}>{extra?.profit != null ? `${N(Math.round(extra.profit))} lei` : "—"}</b></div>
            <div><span>{t.events}</span><b>{d.events.filter((e) => e.kind !== "start" && e.kind !== "end").length}</b></div>
          </div>
          <div className="rp-sumbtn">
            <button type="button" className="btn pri" onClick={() => { seek(d.start); lastToast.current = d.start - 1; setPlaying(true); }}>↻ {t.again}</button>
            {d.tripId ? <Link className="btn sec" href={`/trips/${d.tripId}`}>{t.openTrip}</Link> : null}
          </div>
        </div>
      </>) : null}
      <aside className="rp-panel">
        {pv ? <p className="rp-privnote">{t.privNote}</p> : null}
        <div className="rp-mini"><span>{t.litres} <b>{N(usedL, 0)} L</b></span><span>{t.fueled} <b>{N(fueled)} L</b></span><span>{t.stops} <b>{fuels.length}</b></span></div>
        <div className="eyebrow" style={{ marginTop: 22 }}>{t.events}</div>
        <div className="rp-evlist">
          {d.events.map((e, i) => (
            <button key={i} type="button" className={`${min >= e.min && min < (e.end ?? e.min + 1) ? "on" : ""} ${min >= e.min ? "past" : ""}`} onClick={() => { setPlaying(false); seek(e.min + 0.01); }}>
              <i style={{ background: EV_COL[e.kind] }} /><b>{hhmm(e.min)}</b><span>{evLabel(e)}</span>{e.place ? <small>{e.place}</small> : null}
            </button>
          ))}
        </div>
        {d.tripId ? <Link className="btn sec" style={{ marginTop: 18, width: "100%" }} href={`/trips/${d.tripId}`}>{t.openTrip}</Link> : null}
      </aside>
      <div className="rp-bar">
        <button className="rp-play" onClick={toggle} aria-label={playing ? t.pauseBtn : t.play}><Icon name={playing ? "pause" : "play"} size={18} /></button>
        <div className="rp-clock" ref={clockRef} />
        <div className="rp-scrub">
          <div className="rp-track"><div className="rp-fill" ref={fillRef} /><div className="rp-thumb" ref={thumbRef} />
            {d.events.filter((e) => e.kind !== "start" && e.kind !== "end").map((e, i) => <span key={i} className={`rp-tick ${e.kind}`} title={evLabel(e)} style={{ left: `${pct(e.min)}%`, width: e.end ? `max(4px, ${pct(e.end) - pct(e.min)}%)` : undefined }} />)}
          </div>
          <input type="range" min={d.start} max={d.end} step={0.5} value={min} onChange={(e) => { setPlaying(false); seek(+e.target.value); }} aria-label={t.scrub} />
          <div className="rp-hours"><span>{hhmm(d.start)}</span><span>{hhmm((d.start + d.end) / 2)}</span><span>{hhmm(d.end)}</span></div>
        </div>
        <button type="button" className={`rp-hl${hl ? " on" : ""}`} onClick={() => setHl(!hl)} aria-pressed={hl} title={t.hlHint}aria-label={t.hl}>⚡<span className="rp-hlt"> {t.hl}</span></button>
        <div className="rp-seg">{SPEEDS.map((s) => <button key={s} className={speed === s ? "on" : ""} onClick={() => setSpeed(s)}>{s}×</button>)}</div>
        <button className={`rp-follow${follow ? " on" : ""}`} onClick={() => setFollow(!follow)} title={t.follow} aria-label={t.follow}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></button>
      </div>
    </div>
  );
}
