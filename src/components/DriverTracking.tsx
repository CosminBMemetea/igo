"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackingHold } from "@/lib/tracking-hold";
import { usePathname } from "next/navigation";
import { startWebTracking, type TrackingStatus } from "@/lib/web-tracking";
import { tri, type Locale } from "@/lib/i18n";

const WAIT: TrackingStatus = { gps: "wait", lastAck: null };
const Tracking = createContext<TrackingStatus>(WAIT);
export const useDriverTracking = () => useContext(Tracking);
export function DriverTracking({ enabled, scope, loc, children }: { enabled: boolean; scope: string; loc: Locale; children: React.ReactNode }) {
  const [status, setStatus] = useState(WAIT), [active, setActive] = useState(false);
  const path = usePathname(), refresh = useRef<() => void>(() => {});
  useEffect(() => {
    if (!enabled) { setStatus(WAIT); setActive(false); return; }
    const safeStorage = { getItem: (key: string) => window.localStorage.getItem(key), setItem: (key: string, value: string) => window.localStorage.setItem(key, value), removeItem: (key: string) => window.localStorage.removeItem(key) };
    const hold = trackingHold(safeStorage, scope);
    setStatus({ ...WAIT, held: hold.held() });
    let disposed = false, version = 0, key = "", lastState = 0;
    let stop: (() => void) | null = null, request: AbortController | null = null;
    const pause = () => { stop?.(); stop = null; key = ""; setStatus({ ...WAIT, held: hold.held() }); };
    const read = async () => {
      if (hold.held()) return;
      const sequence = ++version;
      request?.abort(); const controller = new AbortController(); request = controller;
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const r = await fetch("/api/driver/tracking", { signal: controller.signal, cache: "no-store" });
        const state = r.ok && !r.redirected ? await r.json() : null;
        if (disposed || sequence !== version) return;
        lastState = Date.now();
        const valid = state?.enabled === true && typeof state.vehicleId === "string" && typeof state.shiftStart === "string";
        setActive(valid);
        if (!valid || document.visibilityState !== "visible") { pause(); return; }
        if (!navigator.geolocation) { pause(); setStatus({ gps: "off", lastAck: null }); return; }
        const nextKey = `${state.vehicleId}:${state.shiftStart}`;
        if (key === nextKey) return;
        pause(); key = nextKey;
        stop = startWebTracking(navigator.geolocation, state.vehicleId, setStatus, () => { pause(); void read(); });
      } catch { if (!disposed && sequence === version) { pause(); setStatus({ gps: "error", lastAck: null }); } }
      finally { clearTimeout(timeout); }
    };
    const shift = (event: Event) => {
      if (event.type === "qf-tracking-pause") hold.pause();
      if (event.type === "qf-tracking-resume") hold.resume();
      // A local stop/private action invalidates any older state response immediately.
      if (event.type === "qf-tracking-pause" || (event as CustomEvent).detail === false) { ++version; request?.abort(); pause(); }
      if (event.type !== "qf-tracking-pause") void read();
    };
    const storage = (event: StorageEvent) => { if (event.key === hold.key || event.key === null) { hold.read(); ++version; request?.abort(); pause(); void read(); } };
    const visibility = () => { if (document.visibilityState !== "visible") { ++version; request?.abort(); pause(); } else void read(); };
    refresh.current = () => { void read(); };
    const interval = setInterval(() => {
      if (Date.now() - lastState > 45000) pause();
      setStatus(previous => previous.lastAck && Date.now() - previous.lastAck > 90000 ? WAIT : previous);
      if (document.visibilityState === "visible") void read();
    }, 15000);
    window.addEventListener("storage", storage); window.addEventListener("qf-tracking-resume", shift);
    window.addEventListener("qf-shift", shift); window.addEventListener("qf-tracking-pause", shift);
    window.addEventListener("online", refresh.current); document.addEventListener("visibilitychange", visibility);
    void read();
    return () => {
      disposed = true; ++version; request?.abort(); stop?.(); clearInterval(interval);
      window.removeEventListener("storage", storage); window.removeEventListener("qf-tracking-resume", shift);
      window.removeEventListener("qf-shift", shift); window.removeEventListener("qf-tracking-pause", shift);
      window.removeEventListener("online", refresh.current); document.removeEventListener("visibilitychange", visibility);
      refresh.current = () => {};
    };
  }, [enabled, scope]);
  useEffect(() => { refresh.current(); }, [path]);
  return <Tracking.Provider value={status}>
    {enabled && active && path !== "/driver" ? <div className="driver-tracking-banner" role="status">
      <span>{status.gps === "ok" ? tri(loc, "GPS trimis · tură activă|GPS sent · on shift|GPS wysłany · aktywna zmiana") : tri(loc, "Tură activă · GPS neconfirmat|On shift · GPS unconfirmed|Aktywna zmiana · GPS niepotwierdzony")}</span>
      <Link href="/driver" className="btn sec sm">{tri(loc, "Tură și confidențialitate|Shift & privacy|Zmiana i prywatność")}</Link>
    </div> : null}
    {children}
  </Tracking.Provider>;
}
