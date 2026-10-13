"use client";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { fmtMoney, fmtNum, type Locale } from "@/lib/i18n";
import type { LiveVehicle } from "@/lib/query";
import type { Parcel, Zone } from "@/lib/fleet/seed";
import { Icon } from "./icons";

// Fundal: Esri World Gray Canvas + etichete (fără cheie). DOAR pentru demo; în producție: furnizor cu licență (MapTiler/Stadia/Esri plătit).
const tileUrl = (theme: string, layer: "Base" | "Reference") => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${theme === "light" ? "Light" : "Dark"}_Gray_${layer}/MapServer/tile/{z}/{y}/{x}`;
const ACC = "#3b82f6";
type LL = [number, number];
/** Traseu: porțiunea parcursă estompată, cea rămasă în accent cu o strălucire fină; capete și îmbinări rotunjite. */
function drawRoute(L: typeof Leaflet, g: Leaflet.LayerGroup, done: LL[], ahead: LL[], strong = true) {
  const base = { lineCap: "round", lineJoin: "round", smoothFactor: 1.2, interactive: false } as const;
  if (done.length > 1) g.addLayer(L.polyline(done, { ...base, color: ACC, weight: strong ? 3 : 2, opacity: strong ? 0.32 : 0.22 }));
  if (ahead.length > 1) {
    g.addLayer(L.polyline(ahead, { ...base, color: ACC, weight: strong ? 12 : 8, opacity: strong ? 0.16 : 0.1, className: "glow" }));
    g.addLayer(L.polyline(ahead, { ...base, color: ACC, weight: strong ? 3 : 2, opacity: strong ? 0.95 : 0.7 }));
  }
}
const COL: Record<string, string> = { moving: "var(--pos)", working: "var(--acc)", stopped: "var(--fg2)", pump: "#f5a524", offline: "var(--fg3)", private: "#a78bfa" };
const located = (x: LiveVehicle): x is LiveVehicle & { at: [number, number] } => x.at != null;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export interface MapLabels { [k: string]: string }
interface Props { mode: "strip" | "full"; vehicles: LiveVehicle[]; zones: Zone[]; parcels: Parcel[]; theme: "dark" | "light"; loc: Locale; labels: MapLabels; now: number; initial?: string ; fitAll?: boolean }

export default function FleetMap({ mode, vehicles, zones, parcels, theme, loc, labels, now, initial, fitAll }: Props) {
  const fitted = useRef(false);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ L: typeof Leaflet; map: Leaflet.Map; cluster: Leaflet.MarkerClusterGroup; trail?: Leaflet.LayerGroup; ghost?: Leaflet.CircleMarker } | null>(null);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState(initial ?? vehicles.find((v) => v.status === "moving")?.id ?? vehicles[0].id);
  const [filter, setFilter] = useState<"all" | "truck" | "agri" | "van">("all");
  const [minute, setMinute] = useState(now);
  const [playing, setPlaying] = useState(false);
  const v = vehicles.find((x) => x.id === sel)!;
  const shown = useMemo(() => vehicles.filter((x) => filter === "all" || x.kind === filter), [vehicles, filter]);

  // init
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      (window as unknown as { L: typeof Leaflet }).L = L;
      await import("leaflet.markercluster");
      if (dead || !el.current) return;
      const map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: mode === "full", dragging: mode === "full" || !matchMedia("(max-width:760px)").matches });
      L.tileLayer(tileUrl(theme, "Base"), { attribution: "Esri, HERE, Garmin, © OpenStreetMap contributors", maxZoom: 16 }).addTo(map);
      L.tileLayer(tileUrl(theme, "Reference"), { maxZoom: 16, opacity: 0.55, pane: "overlayPane" }).addTo(map);
      for (const z of zones) L.circle(z.at, { radius: z.radiusM, color: "#3e6ae1", weight: 1, fillOpacity: 0.08, dashArray: "4 6" }).addTo(map).bindTooltip(z.name);
      for (const p of parcels) L.polygon(p.poly, { color: "#34d399", weight: 1, fillOpacity: 0.16 }).addTo(map).bindTooltip(`${p.name} · ${p.ha} ha`);
      const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 44, iconCreateFunction: (c) => L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: "cl", iconSize: [44, 44] }) });
      map.addLayer(cluster);
      map.setView([46.9, 21.9], 7);
      // QA: harta goală la prima încărcare — containerul își primește mărimea după init; re-măsurăm
      requestAnimationFrame(() => map.invalidateSize()); setTimeout(() => map.invalidateSize(), 400);
      if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(() => map.invalidateSize()); ro.observe(el.current); map.on("unload", () => ro.disconnect()); }
      mapRef.current = { L, map, cluster };
      setReady(true);
    })();
    return () => { dead = true; mapRef.current?.map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markere
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    m.cluster.clearLayers();
    for (const x of shown.filter(located)) {
      const icon = m.L.divIcon({ className: "", iconSize: undefined, html: `<div class="vm${x.id === sel && mode === "full" ? " sel" : ""}"><i style="background:${COL[x.status]}"></i><span>${x.name.replace(/</g, "")}</span></div>` });
      const mk = m.L.marker(x.at, { icon });
      if (mode === "full") mk.on("click", () => { setSel(x.id); setMinute(now); });
      m.cluster.addLayer(mk);
    }
  }, [ready, shown, sel, mode, now]);

  // traseu + încadrare
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    m.trail?.remove();
    const g = m.L.layerGroup().addTo(m.map); m.trail = g;
    const pts = (x: LiveVehicle) => [...x.done, ...x.ahead];
    if (mode === "strip") {
      if (vehicles.length === 1) {
        drawRoute(m.L, g, vehicles[0].done, vehicles[0].ahead);
        const all = pts(vehicles[0]);
        if (all.length > 1) m.map.fitBounds(m.L.latLngBounds(all).pad(0.12), { maxZoom: 12 });
        else if (vehicles[0].at) m.map.setView(vehicles[0].at, 11);
      } else {
        for (const x of vehicles) drawRoute(m.L, g, x.done, x.ahead, false);
        { const pl = vehicles.filter(located).map((x) => x.at); if (pl.length) m.map.fitBounds(m.L.latLngBounds(pl).pad(0.15), { maxZoom: 9 }); }
      }
      return;
    }
    for (const x of vehicles) if (x.id !== v.id && x.ahead.length > 1) g.addLayer(m.L.polyline(x.ahead, { color: ACC, weight: 2, opacity: 0.28, lineCap: "round", lineJoin: "round", interactive: false }));
    drawRoute(m.L, g, v.done, v.ahead);
    const fleet = vehicles.filter(located).map((x) => x.at);
    // prima încadrare pe /live (fără ?v=): toată flota pe ecran → „Toate · 14” = markerele vizibile + cele în privat
    const first = fitAll && !fitted.current; fitted.current = true;
    const all = first && fleet.length ? [...fleet, ...pts(v)] : pts(v).length > 1 ? pts(v) : v.at ? [v.at, v.at] : fleet;
    if (!all.length) return;
    const mobile = matchMedia("(max-width:760px)").matches;
    m.map.fitBounds(m.L.latLngBounds(all).pad(mobile ? 0.15 : 0.3), { paddingTopLeft: mobile ? [20, 170] : [0, 0], paddingBottomRight: mobile ? [20, innerHeight * 0.46 + 120] : [420, 120], maxZoom: 13 });
  }, [ready, sel, mode, v, vehicles]);

  // reluare
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready || mode !== "full") return;
    m.ghost?.remove(); m.ghost = undefined;
    if (minute >= now) return;
    const pts = v.track; let p = pts[0];
    if (!p) return;
    for (const x of pts) if (x.min <= minute) p = x;
    m.ghost = m.L.circleMarker(p.at, { radius: 8, color: "#fff", weight: 3, fillColor: ACC, fillOpacity: 1 }).addTo(m.map);
  }, [ready, minute, v, now, mode]);
  useEffect(() => {
    if (!playing) return;
    const i = setInterval(() => setMinute((x) => { if (x >= now) { setPlaying(false); return now; } return Math.min(now, x + 10); }), 80);
    return () => clearInterval(i);
  }, [playing, now]);

  if (mode === "strip") return <div ref={el} style={{ position: "absolute", inset: 0 }} />;
  const N = (n: number, d = 0) => fmtNum(loc, n, d);
  const ago = v.secondsAgo < 60 ? labels["ago.s"].replace("{n}", String(v.secondsAgo)) : labels["ago.m"].replace("{n}", String(Math.round(v.secondsAgo / 60)));
  // numărăm ce e pe hartă: vehiculele în pauză privată nu au marker (le arată chip-ul „🔒 N în privat”)
  // „Toate” = toată flota (ca pe Economii/Clasament); cele în pauză privată n-au marker — le arată chip-ul „🔒 N în privat”
  const onMap = vehicles;
  const counts = { all: onMap.length, truck: onMap.filter((x) => x.kind === "truck").length, agri: onMap.filter((x) => x.kind === "agri").length, van: onMap.filter((x) => x.kind === "van").length };
  return (
    <>
      <div ref={el} className="livemap" />
      <div className="filters">
        {(["all", "truck", "agri", "van"] as const).filter((k) => k === "all" || (counts[k] > 0 && counts[k] < counts.all)).map((k) => <button key={k} className={`cat${filter === k ? " on" : ""}`} style={{ border: 0 }} onClick={() => setFilter(k)}>{labels[`f.${k}`]} · {counts[k]}</button>)}
        <span className="cat gdprchip" title={labels.gdpr}>🔒 {labels.privCount.replace("{n}", String(vehicles.filter((x) => x.status === "private").length))}</span>
      </div>
      <div className="replay">
        <button className="play" onClick={() => { if (minute >= now) setMinute(0); setPlaying((p) => !p); }} aria-label="play"><Icon name={playing ? "pause" : "play"} size={16} /></button>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 300, width: 48 }}>{hhmm(minute)}</span>
        <input type="range" min={0} max={now} step={10} value={minute} onChange={(e) => { setPlaying(false); setMinute(+e.target.value); }} aria-label={labels.replay} />
        <span className="badge acc">{labels.replay}</span>
      </div>
      <aside className="panel">
        <div className="eyebrow">{labels[`kind.${v.kind}`]}</div>
        <div className="phead"><div style={{ fontSize: 32, fontWeight: 300, letterSpacing: "-.02em", marginTop: 6 }}>{v.name}</div>{v.kind === "truck" ? <Link className="rp-mini" href={`/replay?v=${v.id}`}><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>{labels.rpShift}</Link> : null}</div>
        <div className="pill" style={{ marginTop: 10 }}><span className="dot" style={{ background: COL[v.status], margin: 0 }} />{labels[`st.${v.status}`]}{v.status === "private" ? "" : ` · ${ago}`}</div>
        {v.status === "private" ? <div className="privnote">{labels.privPanel}</div> : null}
        <div style={{ display: v.status === "private" ? "none" : "flex", alignItems: "baseline", gap: 8, marginTop: 26 }}><span style={{ fontSize: 76, fontWeight: 200, letterSpacing: "-.04em", lineHeight: 1 }}>{N(v.speed)}</span><span style={{ color: "var(--fg2)" }}>km/h</span></div>
        <div className="eta">
          <div className="eyebrow">{labels.eta ?? "ETA"}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}><span style={{ fontSize: 34, fontWeight: 300 }}>{v.eta ?? "—"}</span><span style={{ color: "var(--fg2)", fontSize: 14 }}>{v.left ? `${N(v.left)} ${v.leftUnit} ${labels.left}` : ""}</span></div>
          <div className="sub" style={{ marginTop: 6 }}>{v.dest}</div>
        </div>
        <div className="stat">
          <div><div className="k">{labels.driver}</div><div className="v" style={{ fontSize: 17 }}>{v.driver}</div></div>
          <div><div className="k">{labels.today}</div><div className="v">{N(v.today, v.todayUnit === "h" ? 1 : 0)} {v.todayUnit}</div></div>
          <div><div className="k">{v.rateUnit}</div><div className="v">{N(v.rate, 1)}</div></div>
          <div><div className="k">{labels.profitToday}</div><div className={`v ${v.profitToday != null && v.profitToday < 0 ? "neg" : "pos"}`}>{v.profitToday != null ? fmtMoney(loc, v.profitToday) : "—"}</div></div>
        </div>
        <div className="eyebrow" style={{ marginTop: 26 }}>{labels.zones}</div>
        <div className="kv">
          {v.events.length ? v.events.slice(0, 6).map((e, i) => <Fragment key={i}><div>{e.time} {labels[e.kind]}</div><div>{e.zone}</div></Fragment>) : <><div>{labels.noZones}</div><div /></>}
        </div>
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn sec" href={`/vehicles/${v.id}`}>{labels.open}</Link>
          {v.tripId ? <Link className="btn sec" href={`/trips/${v.tripId}`}>{labels.trip}</Link> : null}

        </div>
      </aside>
      <div className="tiles-note">{labels.tiles}</div>
    </>
  );
}
