// Querra Fleet: avertizare la depășirea limitei setate de patron, din GPS-ul telefonului șoferului.
// Nu este un instrument oficial de măsurare și nu previne amenzile; e o avertizare față de limita firmei.
import { distanceKm } from "./web-tracking";
import { bucharestDay, completedDay } from "./trip-stage";
export interface SpeedSettings { limitKmh: number; truckLimits: Record<string, number>; ownerOverKmh: number; ownerAfterS: number; ownerAlerts: boolean }
export interface SpeedEventRow { id: string; truckId: string; userId: string | null; startAt: string; endAt: string; lastAt: string; limitKmh: number; maxKmh: number; durationS: number; samples: number; lat: number; lng: number; highSince: string | null; highS: number; open: boolean; ownerNotified: boolean;
  /** Last reading above limit+over (null = none in the current run). */ highAt?: string | null;
  /** Owner alert threshold crossed; delivery pending until ownerNotified. */ notifyDue?: boolean; notifyAttempts?: number; notifyNextAt?: string | null; notifyDone?: string[] }
export type SpeedNotifyPatch = Partial<Pick<SpeedEventRow, "ownerNotified" | "notifyDue" | "notifyAttempts" | "notifyNextAt" | "notifyDone">>;
/** Seconds to wait after failed attempt n (1-based). Capped at 1 h so a fixed config (e.g. APP_URL) is picked up within the hour (Testing r22 d). */
export const NOTIFY_BACKOFF_S = [30, 120, 600, 1800, 3600, 3600, 3600];
/** After this many failed attempts the alert is given up; /speeding then shows "Alertă netrimisă" with the missing channels. */
export const NOTIFY_MAX_ATTEMPTS = 8;
export type NotifyChannel = "inbox" | "email" | "push";
/** Channels still missing on a given-up alert (null = not given up: sent, deduped, or still retrying). Owners = active owners now. */
export function unsentChannels(e: Pick<SpeedEventRow, "notifyDue" | "ownerNotified" | "notifyAttempts" | "notifyDone">, owners: { id: string; email?: string | null; emailAlerts?: boolean | null }[]): NotifyChannel[] | null {
  const done = e.notifyDone ?? [];
  if (!e.notifyDue || e.ownerNotified || (e.notifyAttempts ?? 0) < NOTIFY_MAX_ATTEMPTS || done.includes("deduped")) return null;
  const miss = new Set<NotifyChannel>();
  if (!done.includes("inbox")) miss.add("inbox");
  for (const u of owners) { if (u.email && u.emailAlerts !== false && !done.includes(`email:${u.id}`)) miss.add("email"); if (!done.includes(`push:${u.id}`)) miss.add("push"); }
  return (["inbox", "email", "push"] as const).filter(c => miss.has(c));
}
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
/** A dip below limit+over of at most this (measured from the last high reading) keeps the owner timer; the dip itself never counts. Longer dips start a fresh run. The event closes only below limit+tolerance. */
export const HIGH_GRACE_S = 10;
export const limitFor = (s: SpeedSettings, truckId: string) => s.truckLimits[truckId] ?? s.limitKmh;
const sec = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 1000;
/** Validates owner input. Returns null when any value is out of range. */
export function parseSpeedSettings(i: { limit?: unknown; over?: unknown; after?: unknown; alerts?: unknown; trucks?: Record<string, unknown> }, truckIds: string[]): SpeedSettings | null {
  const int = (v: unknown, lo: number, hi: number) => { const n = typeof v === "number" ? v : typeof v === "string" && /^(0|[1-9][0-9]{0,3})$/.test(v) ? Number(v) : NaN; return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
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
  const close = (e: SpeedEventRow) => { if (e.samples < 2 && e.durationS < MIN_EVENT_S) out.drop.push(e.id); else out.save.push({ ...e, open: false, highSince: null, highAt: null }); };
  let ev = open;
  if (ev && sec(ev.lastAt, cur.at) > GAP_S) { close(ev); ev = null; }
  if (kmh == null) return out;
  const limit = ev?.limitKmh ?? limitFor(cfg, truckId);
  const over = kmh > limit + SPEED_TOLERANCE_KMH, high = kmh > limit + cfg.ownerOverKmh;
  if (ev && sec(ev.lastAt, cur.at) <= 0) return out; // duplicate (dt = 0) or out-of-order reading
  // last high reading (legacy rows without highAt: highSince + highS)
  const prevHighAt = ev?.highAt ?? (ev?.highSince ? new Date(Date.parse(ev.highSince) + ev.highS * 1000).toISOString() : null);
  const inGrace = prevHighAt != null && sec(prevHighAt, cur.at) <= HIGH_GRACE_S;
  if (!over) { if (ev) close(ev); return out; }
  const next: SpeedEventRow = ev
    ? { ...ev, endAt: cur.at, lastAt: cur.at, durationS: Math.round(sec(ev.startAt, cur.at)), samples: ev.samples + 1, maxKmh: Math.max(ev.maxKmh, kmh), ...(kmh > ev.maxKmh ? { lat: cur.lat, lng: cur.lng } : {}) }
    : { id: newId(), truckId, userId, startAt: cur.at, endAt: cur.at, lastAt: cur.at, limitKmh: limit, maxKmh: kmh, durationS: 0, samples: 1, lat: cur.lat, lng: cur.lng, highSince: null, highS: 0, open: true, ownerNotified: false, highAt: null, notifyDue: false, notifyAttempts: 0, notifyNextAt: null, notifyDone: [] };
  // highS = seconds spent above limit+over in the current run, counted only between two consecutive high readings:
  // time below the threshold (even inside the grace window) never counts. A run survives a dip shorter than HIGH_GRACE_S;
  // a longer dip ends it, and the next high reading starts a fresh run at 0.
  const run = ev?.highSince != null && prevHighAt != null;
  if (high) {
    if (run && ev!.lastAt === prevHighAt) { next.highS = ev!.highS + Math.round(sec(prevHighAt!, cur.at)); next.highSince = ev!.highSince; }
    else if (run && inGrace) { next.highS = ev!.highS; next.highSince = ev!.highSince; } // resumed within the grace window: the dip adds nothing
    else { next.highSince = cur.at; next.highS = 0; }
    next.highAt = cur.at;
  } else if (!inGrace) { next.highSince = null; next.highS = 0; next.highAt = null; }
  else next.highAt = prevHighAt;
  // Due once per event; delivery and retries (with backoff) are handled by the service, not on every reading.
  if (cfg.ownerAlerts && !next.ownerNotified && !next.notifyDue && next.highS > cfg.ownerAfterS) { next.notifyDue = true; out.notify = next; }
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
const NUM = /^-?[0-9]+(\.[0-9]+)?$/;
/** CSV cell: numbers (incl. negative longitudes) pass as-is; text starting with = + - @ or a tab/CR is neutralised with '. */
export const csvCell = (v: string | number) => { const s = String(v); if (typeof v === "number" || NUM.test(s)) return s; const inj = /^[=+\-@\t\r]/.test(s); return inj || /[",;\n\r]/.test(s) ? `"${(inj ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
export const SPEED_CSV_HEAD = {
  ro: ["Început (ora României)", "Sfârșit (ora României)", "Camion", "Șofer", "Limită km/h", "Maxim km/h", "Peste limită km/h", "Durată s", "Lat", "Lng"],
  en: ["Start (Romania time)", "End (Romania time)", "Truck", "Driver", "Limit km/h", "Max km/h", "Over limit km/h", "Duration s", "Lat", "Lng"],
  pl: ["Początek (czas Rumunii)", "Koniec (czas Rumunii)", "Ciężarówka", "Kierowca", "Limit km/h", "Maks. km/h", "Ponad limit km/h", "Czas s", "Lat", "Lng"],
} as const;
export function speedCsv(rows: { plate: string; driver: string; e: SpeedEventRow }[], fmt: (iso: string) => string, loc: "ro" | "en" | "pl" = "pl") {
  const q = csvCell, head = SPEED_CSV_HEAD[loc].map(h => q(h));
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
export { bucharestDay };
type RTrip = { driverId?: string | null; truckId?: string; km: number; date: string; cancelledAt?: string | null; deliveredAt?: string | null; planned?: boolean; loadedAt?: string | null };
/** Finished = the shared `completedDay` definition (same as the fuel score), within the window. */
const finishedSince = (trips: RTrip[], sinceDay: string) => trips.filter(t => { const d = completedDay(t); return d != null && d >= sinceDay; });
const sumKm = (ts: RTrip[]) => ts.reduce((a, t) => a + (Number.isFinite(t.km) && t.km > 0 ? t.km : 0), 0);
type REvent = Pick<SpeedEventRow, "userId" | "truckId" | "durationS" | "open" | "samples" | "startAt">;
/** Real-firm score input per driver (the ranking row is per driver; trucks vary): 0..1, only with enough km on finished trips. */
export type SpeedPart = { part: number; per100: number; events: number; km: number };
export function speedParts(trips: RTrip[], events: REvent[], sinceDay: string): Record<string, SpeedPart> {
  const done = finishedSince(trips, sinceDay), out: Record<string, SpeedPart> = {};
  for (const id of new Set(done.map(t => t.driverId).filter((x): x is string => !!x))) {
    const km = sumKm(done.filter(t => t.driverId === id)), ex = speedExposure(events.filter(e => e.userId === id && bucharestDay(e.startAt) >= sinceDay), km, 0);
    if (ex) out[id] = { part: ex.score / 100, per100: ex.per100, events: ex.events, km: Math.round(km) };
  }
  return out;
}
export function speedRanking(drivers: { id: string; name: string }[], trips: RTrip[], events: Pick<SpeedEventRow, "userId" | "durationS" | "open" | "samples" | "startAt">[], sinceDay: string) {
  const done = finishedSince(trips, sinceDay);
  return drivers.map(d => {
    const km = sumKm(done.filter(t => t.driverId === d.id));
    const ex = speedExposure(events.filter(e => e.userId === d.id && bucharestDay(e.startAt) >= sinceDay), km, 0);
    return { id: d.id, name: d.name, km: Math.round(km), ex };
  }).filter(r => r.ex).sort((a, b) => a.ex!.per100 - b.ex!.per100 || a.name.localeCompare(b.name));
}
