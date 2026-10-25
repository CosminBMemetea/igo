import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Location from "expo-location";

/** System location switch (Android Location / iOS Location Services). null = could not be read. */
export async function locationServicesOn(): Promise<boolean | null> {
  try { return await Location.hasServicesEnabledAsync(); } catch { return null; }
}

/**
 * Turn the phone's location back on. Android: the Play services "Turn on location" dialog,
 * else the system Location settings screen. iOS cannot open that screen directly: app settings.
 * Returns whether location is on afterwards (null when unknown).
 */
export async function openLocationSettings(): Promise<boolean | null> {
  if (Platform.OS === "android") {
    try { await Location.enableNetworkProviderAsync(); const on = await locationServicesOn(); if (on) return on; } catch {}
    try { await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS"); return null; } catch {}
  }
  try { await Linking.openSettings(); } catch {}
  return null;
}

/** Watches the system location switch while `watch` is true: on start, on return to the app, every 10 s. */
export function useLocationServices(watch: boolean) {
  const [on, setOn] = useState<boolean | null>(null);
  const check = useCallback(async () => { const v = await locationServicesOn(); setOn(v); return v; }, []);
  useEffect(() => {
    if (!watch) return;
    let alive = true;
    const run = () => { if (AppState.currentState === "active") void locationServicesOn().then(v => { if (alive) setOn(v); }); };
    run();
    const timer = setInterval(run, 10_000), sub = AppState.addEventListener("change", s => { if (s === "active") run(); });
    return () => { alive = false; clearInterval(timer); sub.remove(); };
  }, [watch]);
  return { off: watch && on === false, check };
}
