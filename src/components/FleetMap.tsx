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

// Fundal: Esri World Gray Canvas (fără cheie). DOAR pentru demo; în producție: furnizor cu licență (MapTiler/Stadia/Esri plătit).
const tileUrl = (theme: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${theme === "light" ? "Light" : "Dark"}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const COL: Record<string, string> = { moving: "var(--pos)", working: "var(--acc)", stopped: "var(--fg2)", pump: "#f5a524", offline: "var(--fg3)" };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export interface MapLabels { [k: string]: string }
interface Props { mode: "strip" | "full"; vehicles: LiveVehicle[]; zones: Zone[]; parcels: Parcel[]; theme: "dark" | "light"; loc: Locale; labels: MapLabels; now: number; initial?: string }

export default function FleetMap({ mode, vehicles, zones, parcels, theme, loc, labels, now, initial }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ L: typeof Leaflet; map: Leaflet.Map; cluster: Leaflet.MarkerClusterGroup; trail?: Leaflet.Polyline; ghost?: Leaflet.CircleMarker } | null>(null);
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
      L.tileLayer(tileUrl(theme), { attribution: "Esri, HERE, Garmin, © OpenStreetMap", maxZoom: 16 }).addTo(map);
      for (const z of zones) L.circle(z.at, { radius: z.radiusM, color: "#3e6ae1", weight: 1, fillOpacity: 0.08, dashArray: "4 6" }).addTo(map).bindTooltip(z.name);
      for (const p of parcels) L.polygon(p.poly, { color: "#34d399", weight: 1, fillOpacity: 0.16 }).addTo(map).bindTooltip(`${p.name} · ${p.ha} ha`);
      const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 44, iconCreateFunction: (c) => L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: "cl", iconSize: [44, 44] }) });
      map.addLayer(cluster);
      map.setView([46.9, 21.9], 7);
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
    for (const x of shown) {
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
    if (mode === "strip") {
      if (vehicles.length === 1 && vehicles[0].track.length > 1) {
        m.trail = m.L.polyline(vehicles[0].track.map((p) => p.at), { color: "#3e6ae1", weight: 4, opacity: 0.9 }).addTo(m.map);
        m.map.fitBounds(m.trail.getBounds().pad(0.2), { maxZoom: 13 });
      } else m.map.fitBounds(m.L.latLngBounds(vehicles.map((x) => x.at)).pad(0.15), { maxZoom: 9 });
      return;
    }
    m.trail = m.L.polyline(v.track.map((p) => p.at), { color: "#3e6ae1", weight: 4, opacity: 0.9 }).addTo(m.map);
    const mobile = matchMedia("(max-width:760px)").matches;
    m.map.fitBounds(m.trail.getBounds().pad(mobile ? 0.15 : 0.4), { paddingTopLeft: mobile ? [20, 170] : [0, 0], paddingBottomRight: mobile ? [20, innerHeight * 0.46 + 90] : [420, 90], maxZoom: 13 });
  }, [ready, sel, mode, v, vehicles]);

  // reluare
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready || mode !== "full") return;
    m.ghost?.remove(); m.ghost = undefined;
    if (minute >= now) return;
    const pts = v.track; let p = pts[0];
    for (const x of pts) if (x.min <= minute) p = x;
    m.ghost = m.L.circleMarker(p.at, { radius: 8, color: "#fff", weight: 3, fillColor: "#3e6ae1", fillOpacity: 1 }).addTo(m.map);
  }, [ready, minute, v, now, mode]);
  useEffect(() => {
    if (!playing) return;
    const i = setInterval(() => setMinute((x) => { if (x >= now) { setPlaying(false); return now; } return Math.min(now, x + 10); }), 80);
    return () => clearInterval(i);
  }, [playing, now]);

  if (mode === "strip") return <div ref={el} style={{ position: "absolute", inset: 0 }} />;
  const N = (n: number, d = 0) => fmtNum(loc, n, d);
  const ago = v.secondsAgo < 60 ? labels["ago.s"].replace("{n}", String(v.secondsAgo)) : labels["ago.m"].replace("{n}", String(Math.round(v.secondsAgo / 60)));
  const counts = { all: vehicles.length, truck: vehicles.filter((x) => x.kind === "truck").length, agri: vehicles.filter((x) => x.kind === "agri").length, van: vehicles.filter((x) => x.kind === "van").length };
  return (
    <>
      <div ref={el} className="livemap" />
      <div className="filters">
        {(["all", "truck", "agri", "van"] as const).map((k) => <button key={k} className={`cat${filter === k ? " on" : ""}`} style={{ border: 0 }} onClick={() => setFilter(k)}>{labels[`f.${k}`]} · {counts[k]}</button>)}
      </div>
      <div className="replay">
        <button className="play" onClick={() => { if (minute >= now) setMinute(0); setPlaying((p) => !p); }} aria-label="play"><Icon name={playing ? "pause" : "play"} size={16} /></button>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 300, width: 48 }}>{hhmm(minute)}</span>
        <input type="range" min={0} max={now} step={10} value={minute} onChange={(e) => { setPlaying(false); setMinute(+e.target.value); }} aria-label={labels.replay} />
        <span className="badge acc">{labels.replay}</span>
      </div>
      <aside className="panel">
        <div className="eyebrow">{labels[`kind.${v.kind}`]}</div>
        <div style={{ fontSize: 32, fontWeight: 300, letterSpacing: "-.02em", marginTop: 6 }}>{v.name}</div>
        <div className="pill" style={{ marginTop: 10 }}><span className="dot" style={{ background: COL[v.status], margin: 0 }} />{labels[`st.${v.status}`]} · {ago}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 26 }}><span style={{ fontSize: 76, fontWeight: 200, letterSpacing: "-.04em", lineHeight: 1 }}>{N(v.speed)}</span><span style={{ color: "var(--fg2)" }}>km/h</span></div>
        <div className="eta">
          <div className="eyebrow">ETA</div>
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
        <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
          <Link className="btn sec" href={`/vehicles/${v.id}`}>{labels.open}</Link>
          {v.tripId ? <Link className="btn sec" href={`/trips/${v.tripId}`}>{labels.trip}</Link> : null}
        </div>
      </aside>
      <div className="tiles-note">{labels.tiles}</div>
    </>
  );
}
