import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { PermissionsAndroid, Platform } from "react-native";
import { api, ApiError, read, write, remove, abortGPSRequests, sessionScope, type Gate, type Pending } from "./api";
import { pendingControl, queueControl, syncPending } from "./controls";
import { checkSpeed, speedChannel } from "./speed-alert";
export { syncPending } from "./controls";
export const TASK = "qfleet-driver-location-v1";
export type GPSStatus = { message: string; lastAck?: string };
let sending = false, generation = 0, locallyStopped = false;
/** Same ping rules as the web client (r26): at most one ping every 5 s, exponential backoff on failures, longer on 429. */
export const PING_MIN_MS = 5000, BACKOFF_MAX_MS = 300000, LIMITED_MS = 60000;
type Throttle = { last: number; until: number; fails: number };
export function nextThrottle(prev: Throttle, now: number, outcome: "ok" | "drop" | "fail" | "limited"): Throttle {
  if (outcome === "ok") return { last: now, until: 0, fails: 0 };
  if (outcome === "drop") return { ...prev, last: now };
  const fails = prev.fails + 1, wait = Math.min(BACKOFF_MAX_MS, PING_MIN_MS * 2 ** fails);
  return { last: now, fails, until: now + (outcome === "limited" ? Math.max(LIMITED_MS, wait) : wait) };
}
export const mayPing = (th: Throttle | null, now: number) => !th || (now - th.last >= PING_MIN_MS && now >= th.until);
async function status(message: string, lastAck?: string) {
  const previous = await read<GPSStatus>("gps-status");
  await write("gps-status", { message, ...(lastAck || previous?.lastAck ? { lastAck: lastAck ?? previous?.lastAck } : {}) });
}
export async function stopGPS(message = "GPS oprit pe acest telefon") {
  // Synchronous invalidation also cancels a permission/start operation already in progress.
  ++generation; locallyStopped = true; abortGPSRequests();
  try { await remove("gps-gate"); }
  finally {
    // A failed status/storage write must not leave the native location service running.
    try { await write("speed-warning", null).catch(() => {}); if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK); }
    finally { await status(message); }
  }
}
export async function preparePrivateOrStop(pending: Pending) {
  try { await stopGPS(); }
  finally { await queueControl(pending); }
}
export async function privateOrStop(pending: Pending) {
  await preparePrivateOrStop(pending);
  await syncPending();
}
export async function startGPS() {
  const version = ++generation;
  const current = () => { if (version !== generation) throw new Error("Pornirea GPS a fost anulată."); };
  await syncPending(); current();
  const scope = await sessionScope();
  const state = await api<{ enabled: boolean; vehicleId: string; shiftStart: string }>("/api/driver/tracking", undefined, { gps: true, scope }); current();
  if (!state.enabled) throw new Error("GPS se poate activa numai într-o tură deschisă, în afara modului Privat.");
  let foreground = await Location.getForegroundPermissionsAsync(); current();
  if (!foreground.granted && foreground.canAskAgain !== false) { foreground = await Location.requestForegroundPermissionsAsync(); current(); }
  if (!foreground.granted) throw new Error("Permite locația precisă din setările telefonului.");
  if (Platform.OS === "android" && foreground.android?.accuracy === "coarse") throw new Error("Activează locația precisă pentru Querra în Setări.");
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS); current();
    const notifications = granted ? PermissionsAndroid.RESULTS.GRANTED : await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
      title: "Notificarea GPS în tură",
      message: "Querra afișează o notificare cât timp trimite poziția firmei. Permite notificările pentru a vedea când GPS este activ.",
      buttonPositive: "Continuă", buttonNegative: "Mai târziu",
    });
    current();
    if (notifications !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Permite notificările Querra din Setări înainte de a activa GPS în fundal.");
  }
  let background = await Location.getBackgroundPermissionsAsync(); current();
  if (!background.granted && background.canAskAgain !== false) { background = await Location.requestBackgroundPermissionsAsync(); current(); }
  if (!background.granted) throw new Error(Platform.OS === "android" ? "Pentru GPS cu ecranul blocat, permite locația «Tot timpul» din Setări." : "Pentru GPS cu ecranul blocat, permite locația «Întotdeauna» din Setări.");
  // Permission dialogs can stay open while the owner changes the truck/shift.
  const latest = await api<typeof state>("/api/driver/tracking", undefined, { gps: true, scope }); current();
  if (!latest.enabled || latest.vehicleId !== state.vehicleId || latest.shiftStart !== state.shiftStart) throw new Error("Tura sau camionul s-a schimbat. Reîmprospătează înainte de a activa GPS.");
  await speedChannel().catch(() => {});
  await write("gps-throttle", null);
  await write("gps-gate", { vehicleId: state.vehicleId, shiftStart: state.shiftStart, enabledAt: Date.now(), scope } satisfies Gate);
  try {
    current(); locallyStopped = false;
    await Location.startLocationUpdatesAsync(TASK, { accuracy: Location.Accuracy.High, distanceInterval: 100, timeInterval: 30000,
      pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: { notificationTitle: "Querra • GPS în tură", notificationBody: "Poziția este trimisă firmei tale. Oprește GPS sau activează Privat din aplicație.", killServiceOnDestroy: true } });
    current(); await write("gps-status", { message: "GPS pornit • așteptăm prima confirmare" });
  } catch (e) { await stopGPS("GPS nu a pornit"); throw e; }
}
/** Reading state must not trigger permission dialogs or restart a stopped service. */
export async function reconcileGPS() {
  if (await read<Gate>("gps-gate") && !await Location.hasStartedLocationUpdatesAsync(TASK)) await stopGPS("Telefonul a oprit serviciul GPS. Apasă Activează GPS pentru a-l relua.");
}
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (sending || locallyStopped) return;
  sending = true;
  const version = generation;
  let throttle: Throttle | null = null;
  const mark = (outcome: Parameters<typeof nextThrottle>[2]) => write("gps-throttle", nextThrottle(throttle ?? { last: 0, until: 0, fails: 0 }, Date.now(), outcome)).catch(() => {});
  try {
    const gate = await read<Gate>("gps-gate");
    if (!gate || gate.scope !== await sessionScope() || await pendingControl()) { await stopGPS(); return; }
    if (error) { await status("GPS indisponibil. Verifică permisiunile."); return; }
    // Fresh fixes only: nothing from before GPS was enabled or before the shift started (cached first fix).
    const shiftStart = Date.parse(gate.shiftStart);
    const point = data?.locations.filter(p => Number.isFinite(p.timestamp) && p.timestamp >= gate.enabledAt && (!Number.isFinite(shiftStart) || p.timestamp >= shiftStart) && Date.now() - p.timestamp <= 30000 && p.timestamp <= Date.now() + 5000
      && Number.isFinite(p.coords.latitude) && Math.abs(p.coords.latitude) <= 90 && Number.isFinite(p.coords.longitude) && Math.abs(p.coords.longitude) <= 180
      && p.coords.accuracy != null && Number.isFinite(p.coords.accuracy) && p.coords.accuracy >= 0 && p.coords.accuracy <= 65).sort((a,b) => b.timestamp - a.timestamp)[0];
    if (!point) { await status("Așteptăm o poziție precisă"); return; }
    throttle = await read<Throttle>("gps-throttle");
    if (!mayPing(throttle, Date.now())) return;
    const state = await api<{ enabled: boolean; vehicleId: string; shiftStart: string; speedLimitKmh?: number }>("/api/driver/tracking", undefined, { gps: true, scope: gate.scope });
    const current = await read<Gate>("gps-gate");
    if (locallyStopped || version !== generation || !current || current.enabledAt !== gate.enabledAt || current.scope !== gate.scope) return;
    if (!state.enabled || state.vehicleId !== gate.vehicleId || state.shiftStart !== gate.shiftStart) { await stopGPS("Tura sau camionul s-a schimbat • GPS oprit"); return; }
    await api("/api/driver/ping", { vehicleId: gate.vehicleId, lat: point.coords.latitude, lng: point.coords.longitude, capturedAt: new Date(point.timestamp).toISOString(), accuracy: point.coords.accuracy,
      ...(point.coords.speed != null && Number.isFinite(point.coords.speed) && point.coords.speed >= 0 ? { speed: point.coords.speed } : {}) }, { gps: true, scope: gate.scope });
    await mark("ok");
    await checkSpeed(point.coords.speed, point.coords.accuracy, state.speedLimitKmh).catch(() => {});
    if (!locallyStopped && version === generation && (await read<Gate>("gps-gate"))?.enabledAt === gate.enabledAt) await status("Poziție confirmată de server", new Date().toISOString());
  } catch (e) {
    if (e instanceof ApiError && e.status === 422 && e.code === "before-shift") { await mark("drop"); return; } // stale fix: drop it, keep GPS on
    if (e instanceof ApiError && [401,403,409].includes(e.status)) await stopGPS("GPS oprit • verifică sesiunea și tura");
    else {
      await mark(e instanceof ApiError && e.status === 429 ? "limited" : "fail");
      try { if (!locallyStopped && await read("gps-gate")) await status("Fără confirmare • verifică internetul. Punctele nesincronizate nu sunt păstrate."); }
      catch { await stopGPS("GPS oprit • stocarea securizată nu poate fi citită"); }
    }
  } finally { sending = false; }
});
