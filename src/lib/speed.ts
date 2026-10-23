// Querra Fleet: avertizare la depășirea limitei setate de patron, din GPS-ul telefonului șoferului.
// Nu este un instrument oficial de măsurare și nu previne amenzile; e o avertizare față de limita firmei.
import { distanceKm } from "./web-tracking";
export interface SpeedSettings { limitKmh: number; truckLimits: Record<string, number>; ownerOverKmh: number; ownerAfterS: number; ownerAlerts: boolean }
export interface SpeedEventRow { id: string; truckId: string; userId: string | null; startAt: string; endAt: string; lastAt: string; limitKmh: number; maxKmh: number; durationS: number; samples: number; lat: number; lng: number; highSince: string | null; highS: number; open: boolean; ownerNotified: boolean }
export interface SpeedSample { at: string; lat: number; lng: number; accuracy: number | null; speedMs?: number | null }
export const SPEED_DEFAULTS: SpeedSettings = { limitKmh: 90, truckLimits: {}, ownerOverKmh: 10, ownerAfterS: 60, ownerAlerts: true };
/** GPS noise margin: speeds up to limit + 3 km/h are not counted. */
export const SPEED_TOLERANCE_KMH = 3;
/** Above this a truck reading is treated as a GPS glitch and ignored. */
export const MAX_PLAUSIBLE_KMH = 140;
/** A gap longer than this between readings closes the open event. */
export const GAP_S = 90;
/** Single-sample events shorter than this are discarded as noise. */
export const MIN_EVENT_S = 10;
export const limitFor = (s: SpeedSettings, truckId: string) => s.truckLimits[truckId] ?? s.limitKmh;
const sec = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 1000;
/** Validates owner input. Returns null when any value is out of range. */
export function parseSpeedSettings(i: { limit?: unknown; over?: unknown; after?: unknown; alerts?: unknown; trucks?: Record<string, unknown> }, truckIds: string[]): SpeedSettings | null {
  const int = (v: unknown, lo: number, hi: number) => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.trim()) : NaN; return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
  const limitKmh = int(i.limit, 30, 130), ownerOverKmh = int(i.over, 1, 50), ownerAfterS = int(i.after, 10, 600);
  if (limitKmh == null || ownerOverKmh == null || ownerAfterS == null) return null;
  const truckLimits: Record<string, number> = {};
  for (const [id, v] of Object.entries(i.trucks ?? {})) {
    if (!truckIds.includes(id)) return null;
    if (v === "" || v == null) continue;
    const n = int(v, 30, 130); if (n == null) return null; truckLimits[id] = n;
  }
  return { limitKmh, truckLimits, ownerOverKmh, ownerAfterS, ownerAlerts: i.alerts === true || i.alerts === "on" || i.alerts === "1" };
}
/** Speed in km/h: the phone's own GPS speed first, else distance/time from the previous fix. Null = unusable reading. */
export function estimateKmh(cur: SpeedSample, prev: SpeedSample | null): number | null {
  const dt = prev ? sec(prev.at, cur.at) : 0;
  const jump = prev && dt > 0 ? (distanceKm([prev.lat, prev.lng], [cur.lat, cur.lng]) * 3600) / dt : null;
  // a position jump faster than any truck means one of the fixes is wrong
  if (jump != null && dt >= 2 && jump > MAX_PLAUSIBLE_KMH * 1.5) return null;
  if (typeof cur.speedMs === "number" && Number.isFinite(cur.speedMs) && cur.speedMs >= 0 && (cur.accuracy == null || cur.accuracy <= 30)) {
    const kmh = cur.speedMs * 3.6;
    return kmh > MAX_PLAUSIBLE_KMH ? null : Math.round(kmh * 10) / 10;
  }
  if (!prev || dt < 5 || dt > 180 || (cur.accuracy ?? 99) > 50 || (prev.accuracy ?? 99) > 50) return null;
  // conservative: subtract the combined position uncertainty from the distance
  const m = Math.max(0, distanceKm([prev.lat, prev.lng], [cur.lat, cur.lng]) * 1000 - ((cur.accuracy ?? 0) + (prev.accuracy ?? 0)) / 2);
  const kmh = (m / dt) * 3.6;
  return kmh > MAX_PLAUSIBLE_KMH ? null : Math.round(kmh * 10) / 10;
}
export type SpeedStep = { save: SpeedEventRow[]; drop: string[]; notify: SpeedEventRow | null };
/** Pure state transition for one reading. `open` is the truck's current open event, if any. */
export function speedStep(open: SpeedEventRow | null, cur: SpeedSample, kmh: number | null, cfg: SpeedSettings, truckId: string, userId: string | null, newId: () => string): SpeedStep {
  const out: SpeedStep = { save: [], drop: [], notify: null };
  const close = (e: SpeedEventRow) => { if (e.samples < 2 && e.durationS < MIN_EVENT_S) out.drop.push(e.id); else out.save.push({ ...e, open: false, highSince: null }); };
  let ev = open;
  if (ev && sec(ev.lastAt, cur.at) > GAP_S) { close(ev); ev = null; }
  if (kmh == null) return out;
  const limit = ev?.limitKmh ?? limitFor(cfg, truckId);
  const over = kmh > limit + SPEED_TOLERANCE_KMH, high = kmh > limit + cfg.ownerOverKmh;
  if (!over) { if (ev) close(ev); return out; }
  if (sec(ev?.lastAt ?? cur.at, cur.at) < 0) return out; // out-of-order reading
  const next: SpeedEventRow = ev
    ? { ...ev, endAt: cur.at, lastAt: cur.at, durationS: Math.round(sec(ev.startAt, cur.at)), samples: ev.samples + 1, maxKmh: Math.max(ev.maxKmh, kmh), ...(kmh > ev.maxKmh ? { lat: cur.lat, lng: cur.lng } : {}) }
    : { id: newId(), truckId, userId, startAt: cur.at, endAt: cur.at, lastAt: cur.at, limitKmh: limit, maxKmh: kmh, durationS: 0, samples: 1, lat: cur.lat, lng: cur.lng, highSince: null, highS: 0, open: true, ownerNotified: false };
  if (high) { next.highSince = next.highSince ?? cur.at; next.highS = Math.max(next.highS, Math.round(sec(next.highSince, cur.at))); } else next.highSince = null;
  if (cfg.ownerAlerts && !next.ownerNotified && next.highS > cfg.ownerAfterS) { next.ownerNotified = true; out.notify = next; }
  out.save.push(next);
  return out;
}
/** Per driver/truck exposure: events per 100 km and share of driving time over the limit. Null when there is too little data. */
export const SPEED_MIN_KM = 300;
export function speedExposure(events: Pick<SpeedEventRow, "durationS" | "open" | "samples">[], km: number, drivingS: number) {
  if (km < SPEED_MIN_KM) return null;
  const real = events.filter(e => !e.open || e.samples >= 2);
  const overS = real.reduce((a, e) => a + e.durationS, 0);
  return { events: real.length, per100: Math.round((real.length / km) * 1000) / 10, pctTime: drivingS > 0 ? Math.round((overS / drivingS) * 1000) / 10 : null, score: Math.round(Math.max(0, Math.min(1, 1 - (real.length / km) * 100 / 2)) * 100) };
}
export function speedCsv(rows: { plate: string; driver: string; e: SpeedEventRow }[], fmt: (iso: string) => string) {
  const q = (v: string | number) => { const s = String(v); return /[",;\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
  const head = ["start", "end", "truck", "driver", "limit_kmh", "max_kmh", "over_kmh", "duration_s", "lat", "lng"];
  return [head.join(","), ...rows.map(({ plate, driver, e }) => [fmt(e.startAt), fmt(e.endAt), plate, driver, e.limitKmh, e.maxKmh, Math.round((e.maxKmh - e.limitKmh) * 10) / 10, e.durationS, e.lat.toFixed(5), e.lng.toFixed(5)].map(q).join(","))].join("\r\n") + "\r\n";
}
/** Driver-side alert gate (web + native copy): alert after `holdS` seconds over limit+tolerance, then at most once per `everyS`. */
export const DRIVER_ALERT_HOLD_S = 5, DRIVER_ALERT_EVERY_S = 120;
export type DriverAlertState = { overSince: number | null; lastAlert: number | null };
export function driverAlert(st: DriverAlertState, kmh: number | null, limit: number, now: number): { st: DriverAlertState; alert: boolean; over: boolean } {
  const over = kmh != null && kmh > limit + SPEED_TOLERANCE_KMH && kmh <= MAX_PLAUSIBLE_KMH;
  if (!over) return { st: { ...st, overSince: null }, alert: false, over };
  const overSince = st.overSince ?? now;
  const alert = now - overSince >= DRIVER_ALERT_HOLD_S * 1000 && (st.lastAlert == null || now - st.lastAlert >= DRIVER_ALERT_EVERY_S * 1000);
  return { st: { overSince, lastAlert: alert ? now : st.lastAlert }, alert, over };
}
/** Real-firm ranking input: per driver, events per 100 km over the last 30 days. km = completed trips attributed to the driver. */
export function speedRanking(drivers: { id: string; name: string }[], trips: { driverId?: string | null; km: number; date: string; cancelledAt?: string | null }[], events: Pick<SpeedEventRow, "userId" | "durationS" | "open" | "samples" | "startAt">[], sinceDay: string) {
  return drivers.map(d => {
    const km = trips.filter(t => t.driverId === d.id && !t.cancelledAt && t.date >= sinceDay).reduce((a, t) => a + (Number.isFinite(t.km) ? t.km : 0), 0);
    const ex = speedExposure(events.filter(e => e.userId === d.id && e.startAt.slice(0, 10) >= sinceDay), km, 0);
    return { id: d.id, name: d.name, km: Math.round(km), ex };
  }).filter(r => r.ex).sort((a, b) => a.ex!.per100 - b.ex!.per100 || a.name.localeCompare(b.name));
}
