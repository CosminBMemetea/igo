export type TrackingStatus = { gps: "wait" | "ok" | "off" | "error"; lastAck: number | null };
export function distanceKm(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  return 12742 * Math.asin(Math.sqrt(Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2));
}
/** One collector per mounted app, independent of the current route. Cleanup rejects late callbacks. */
export function startWebTracking(geo: Geolocation, vehicleId: string, report: (status: TrackingStatus) => void, rejected: () => void, send: typeof fetch = fetch) {
  let alive = true, busy = false, last: { at: [number, number]; time: number } | null = null;
  let request: AbortController | null = null;
  const id = geo.watchPosition(p => {
    if (!alive || busy) return;
    if (!Number.isFinite(p.coords.accuracy) || p.coords.accuracy > 65) { report({ gps: "wait", lastAck: null }); return; }
    const at: [number, number] = [p.coords.latitude, p.coords.longitude], time = Date.now();
    // Do not present a cached old fix as a new live position.
    if (!Number.isFinite(p.timestamp) || time - p.timestamp > 30000 || p.timestamp - time > 5000) return;
    if (last && time - last.time < 30000 && distanceKm(last.at, at) < 0.15) return;
    busy = true;
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    void send("/api/driver/ping", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, lat: at[0], lng: at[1], capturedAt: new Date(p.timestamp).toISOString(), accuracy: p.coords.accuracy }) })
      .then(r => {
        if (!alive) return;
        if (r.status !== 204 || r.redirected) {
          report({ gps: "error", lastAck: null });
          if (r.redirected || [401, 403, 409].includes(r.status)) rejected();
          return;
        }
        last = { at, time }; report({ gps: "ok", lastAck: Date.now() });
      }).catch(() => { if (alive) report({ gps: "error", lastAck: null }); })
      .finally(() => { clearTimeout(timeout); busy = false; });
  }, () => { if (alive) report({ gps: "off", lastAck: null }); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 60000 });
  return () => { alive = false; request?.abort(); geo.clearWatch(id); };
}
