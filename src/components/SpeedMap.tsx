"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
const tileUrl = (theme: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${theme === "light" ? "Light" : "Dark"}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
export type SpeedPin = { id: string; lat: number; lng: number; label: string; over: number };
/** Harta depășirilor: un punct pe eveniment (locul vitezei maxime). */
export default function SpeedMap({ pins, theme }: { pins: SpeedPin[]; theme: "dark" | "light" }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dead = false, map: import("leaflet").Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !el.current || !pins.length) return;
      map = L.map(el.current, { zoomControl: true, attributionControl: true });
      L.tileLayer(tileUrl(theme), { attribution: "Esri, HERE, Garmin, © OpenStreetMap contributors", maxZoom: 16 }).addTo(map);
      const pts = pins.map(p => { L.circleMarker([p.lat, p.lng], { radius: 6 + Math.min(8, p.over / 3), color: p.over >= 10 ? "#ef4444" : "#f5a524", weight: 2, fillOpacity: 0.55 }).bindTooltip(p.label).addTo(map!); return [p.lat, p.lng] as [number, number]; });
      map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 13 });
    })();
    return () => { dead = true; map?.remove(); };
  }, [pins, theme]);
  return pins.length ? <div ref={el} className="sp-map" role="img" aria-label="map" /> : null;
}
