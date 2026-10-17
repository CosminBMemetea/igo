import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { api, ApiError, read, write, remove, abortGPSRequests, sessionScope, type Gate, type Pending } from "./api";
import { pendingControl, queueControl, syncPending } from "./controls";
export { syncPending } from "./controls";
export const TASK = "qfleet-driver-location-v1";
export type GPSStatus = { message: string; lastAck?: string };
let sending = false, generation = 0, locallyStopped = false;
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
    try { if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK); }
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
  const foreground = await Location.requestForegroundPermissionsAsync(); current();
  if (!foreground.granted) throw new Error("Permite locația precisă din setările telefonului.");
  const background = await Location.requestBackgroundPermissionsAsync(); current();
  if (!background.granted) throw new Error("Pentru GPS cu ecranul blocat, permite locația «Întotdeauna» din Setări.");
  const state = await api<{ enabled: boolean; vehicleId: string; shiftStart: string }>("/api/driver/tracking", undefined, { gps: true, scope }); current();
  if (!state.enabled) throw new Error("GPS se poate activa numai într-o tură deschisă, în afara modului Privat.");
  await write("gps-gate", { vehicleId: state.vehicleId, shiftStart: state.shiftStart, enabledAt: Date.now(), scope } satisfies Gate);
  try {
    current(); locallyStopped = false;
    await Location.startLocationUpdatesAsync(TASK, { accuracy: Location.Accuracy.High, distanceInterval: 100, timeInterval: 30000,
      pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: { notificationTitle: "Querra • GPS în tură", notificationBody: "Poziția este trimisă firmei tale. Oprește GPS sau activează Privat din aplicație.", killServiceOnDestroy: true } });
    current(); await status("GPS pornit • așteptăm prima confirmare");
  } catch (e) { await stopGPS("GPS nu a pornit"); throw e; }
}
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (sending || locallyStopped) return;
  sending = true;
  const version = generation;
  try {
    const gate = await read<Gate>("gps-gate");
    if (!gate || gate.scope !== await sessionScope() || await pendingControl()) { await stopGPS(); return; }
    if (error) { await status("GPS indisponibil. Verifică permisiunile."); return; }
    const point = data?.locations.filter(p => Number.isFinite(p.timestamp) && p.timestamp >= gate.enabledAt && Date.now() - p.timestamp <= 30000 && p.timestamp <= Date.now() + 5000
      && Number.isFinite(p.coords.latitude) && Math.abs(p.coords.latitude) <= 90 && Number.isFinite(p.coords.longitude) && Math.abs(p.coords.longitude) <= 180
      && p.coords.accuracy != null && Number.isFinite(p.coords.accuracy) && p.coords.accuracy >= 0 && p.coords.accuracy <= 65).sort((a,b) => b.timestamp - a.timestamp)[0];
    if (!point) { await status("Așteptăm o poziție precisă"); return; }
    const state = await api<{ enabled: boolean; vehicleId: string; shiftStart: string }>("/api/driver/tracking", undefined, { gps: true, scope: gate.scope });
    const current = await read<Gate>("gps-gate");
    if (locallyStopped || version !== generation || !current || current.enabledAt !== gate.enabledAt || current.scope !== gate.scope) return;
    if (!state.enabled || state.vehicleId !== gate.vehicleId || state.shiftStart !== gate.shiftStart) { await stopGPS("Tura sau camionul s-a schimbat • GPS oprit"); return; }
    await api("/api/driver/ping", { vehicleId: gate.vehicleId, lat: point.coords.latitude, lng: point.coords.longitude, capturedAt: new Date(point.timestamp).toISOString(), accuracy: point.coords.accuracy }, { gps: true, scope: gate.scope });
    if (!locallyStopped && version === generation && (await read<Gate>("gps-gate"))?.enabledAt === gate.enabledAt) await status("Poziție confirmată de server", new Date().toISOString());
  } catch (e) {
    if (e instanceof ApiError && [401,403,409].includes(e.status)) await stopGPS("GPS oprit • verifică sesiunea și tura");
    else {
      try { if (!locallyStopped && await read("gps-gate")) await status("Fără confirmare • verifică internetul. Punctele nesincronizate nu sunt păstrate."); }
      catch { await stopGPS("GPS oprit • stocarea securizată nu poate fi citită"); }
    }
  } finally { sending = false; }
});
