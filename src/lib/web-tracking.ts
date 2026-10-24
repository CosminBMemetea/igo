export type TrackingStatus = { gps: "wait" | "ok" | "off" | "error"; lastAck: number | null; held?: boolean };
export function distanceKm(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  return 12742 * Math.asin(Math.sqrt(Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2));
}
/** Hard client cap: never more than one ping per PING_MIN_INTERVAL_MS, whatever the GPS or the server does. */
export const PING_MIN_INTERVAL_MS = 5000, PING_MAX_BACKOFF_MS = 120000;
/** Shared across watch restarts of the same shift, so a reject → restart cycle cannot reset the rate cap or the backoff. */
export type PingGate = { nextAt: number; failures: number };
export const newPingGate = (): PingGate => ({ nextAt: 0, failures: 0 });
/** 0 failures → the plain cap; then 10 s, 20 s, 40 s … capped at 2 min. */
export const pingBackoffMs = (failures: number) => failures <= 0 ? PING_MIN_INTERVAL_MS : Math.min(PING_MAX_BACKOFF_MS, PING_MIN_INTERVAL_MS * 2 ** failures);
export type TrackingOptions = { shiftStart?: number; gate?: PingGate; now?: () => number };
/** One collector per mounted app, independent of the current route. Cleanup rejects late callbacks. */
/** `onSpeed` gets every fix's GPS speed (km/h, null if unusable) before ping throttling, so the driver alert is live. */
export function startWebTracking(geo: Geolocation, vehicleId: string, report: (status: TrackingStatus) => void, rejected: () => void, send: typeof fetch = fetch, onSpeed?: (kmh: number | null) => void, opts: TrackingOptions = {}) {
  const now = opts.now ?? Date.now, gate = opts.gate ?? newPingGate(), shiftStart = opts.shiftStart;
  let alive = true, busy = false, last: { at: [number, number]; time: number } | null = null;
  let request: AbortController | null = null;
  const fail = (status: number, retryAfterS = 0) => {
    gate.failures++;
    gate.nextAt = Math.max(gate.nextAt, now() + pingBackoffMs(gate.failures), status === 429 ? now() + retryAfterS * 1000 : 0);
  };
  // maximumAge 0: never reuse a cached fix (a cached fix can predate the shift start and caused a 409 → restart loop).
  const id = geo.watchPosition(p => {
    if (!alive) return;
    const speed = typeof p.coords.speed === "number" && Number.isFinite(p.coords.speed) && p.coords.speed >= 0 && p.coords.accuracy <= 30 ? p.coords.speed : null;
    onSpeed?.(speed == null ? null : speed * 3.6);
    if (busy) return;
    if (!Number.isFinite(p.coords.accuracy) || p.coords.accuracy > 65) { report({ gps: "wait", lastAck: null }); return; }
    const at: [number, number] = [p.coords.latitude, p.coords.longitude], time = now();
    // Do not present a cached old fix as a new live position.
    if (!Number.isFinite(p.timestamp) || time - p.timestamp > 30000 || p.timestamp - time > 5000) return;
    // A fix taken before this shift started is always rejected by the server: drop it here instead of sending it.
    if (shiftStart !== undefined && p.timestamp < shiftStart) return;
    if (time < gate.nextAt) return;
    if (last && time - last.time < 30000 && distanceKm(last.at, at) < 0.15) return;
    busy = true; gate.nextAt = time + PING_MIN_INTERVAL_MS;
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    void send("/api/driver/ping", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, lat: at[0], lng: at[1], capturedAt: new Date(p.timestamp).toISOString(), accuracy: p.coords.accuracy, ...(speed != null ? { speed } : {}) }) })
      .then(r => {
        if (!alive) return;
        if (r.status !== 204 || r.redirected) {
          fail(r.status, Number(r.headers.get("retry-after")) || 0);
          report({ gps: "error", lastAck: null });
          if (r.redirected || [401, 403, 409].includes(r.status)) rejected();
          return;
        }
        gate.failures = 0;
        last = { at, time }; report({ gps: "ok", lastAck: now() });
      }).catch(() => { if (alive) { fail(0); report({ gps: "error", lastAck: null }); } })
      .finally(() => { clearTimeout(timeout); busy = false; });
  }, () => { if (alive) report({ gps: "off", lastAck: null }); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
  return () => { alive = false; request?.abort(); geo.clearWatch(id); };
}
