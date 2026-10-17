import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { api, ApiError, read, write, remove, abortRequests, type Gate, type Pending } from "./api";
export const TASK = "qfleet-driver-location-v1";
export type GPSStatus = { message: string; lastAck?: string };
let sending = false;
export async function stopGPS(message = "GPS oprit pe acest telefon") {
  // Clear the durable consent gate BEFORE awaiting platform shutdown or network I/O.
  await remove("gps-gate"); abortRequests();
  await write("gps-status", { message });
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
}
export async function syncPending() {
  const pending = await read<Pending>("pending-control");
  if (!pending) return;
  await api(pending.path, pending.body);
  await remove("pending-control");
}
export async function privateOrStop(pending: Pending) {
  await stopGPS();
  await write("pending-control", pending);
  await syncPending();
}
export async function startGPS() {
  await syncPending();
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) throw new Error("Permite locația precisă din setările telefonului.");
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) throw new Error("Pentru GPS cu ecranul blocat, permite locația «Întotdeauna» din Setări.");
  const state = await api<{ enabled: boolean; vehicleId: string; shiftStart: string }>("/api/driver/tracking");
  if (!state.enabled) throw new Error("GPS se poate activa numai într-o tură deschisă, în afara modului Privat.");
  await write("gps-gate", { vehicleId: state.vehicleId, shiftStart: state.shiftStart, enabledAt: Date.now() } satisfies Gate);
  try {
    await Location.startLocationUpdatesAsync(TASK, { accuracy: Location.Accuracy.High, distanceInterval: 100, timeInterval: 30000,
      pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: { notificationTitle: "Querra • GPS în tură", notificationBody: "Poziția este trimisă firmei tale. Oprește GPS sau activează Privat din aplicație.", killServiceOnDestroy: true } });
    await write("gps-status", { message: "GPS pornit • așteptăm prima confirmare" });
  } catch (e) { await stopGPS("GPS nu a pornit"); throw e; }
}
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (sending) return;
  sending = true;
  try {
    const gate = await read<Gate>("gps-gate");
    if (!gate || await read("pending-control")) return;
    if (error) { await write("gps-status", { message: "GPS indisponibil. Verifică permisiunile." }); return; }
    const point = data?.locations.filter(p => Number.isFinite(p.timestamp) && p.timestamp >= gate.enabledAt && Date.now() - p.timestamp <= 30000 && p.timestamp <= Date.now() + 5000 && p.coords.accuracy != null && p.coords.accuracy >= 0 && p.coords.accuracy <= 65).sort((a,b) => b.timestamp - a.timestamp)[0];
    if (!point) { await write("gps-status", { message: "Așteptăm o poziție precisă" }); return; }
    const state = await api<{ enabled: boolean; vehicleId: string; shiftStart: string }>("/api/driver/tracking");
    const current = await read<Gate>("gps-gate");
    if (!current || current.enabledAt !== gate.enabledAt) return;
    if (!state.enabled || state.vehicleId !== gate.vehicleId || state.shiftStart !== gate.shiftStart) { await stopGPS("Tura sau camionul s-a schimbat • GPS oprit"); return; }
    await api("/api/driver/ping", { vehicleId: gate.vehicleId, lat: point.coords.latitude, lng: point.coords.longitude, capturedAt: new Date(point.timestamp).toISOString(), accuracy: point.coords.accuracy });
    if ((await read<Gate>("gps-gate"))?.enabledAt === gate.enabledAt) await write("gps-status", { message: "Poziție confirmată de server", lastAck: new Date().toISOString() } satisfies GPSStatus);
  } catch (e) {
    if (e instanceof ApiError && [401,403,409].includes(e.status)) await stopGPS("GPS oprit • verifică sesiunea și tura");
    else if (await read("gps-gate")) await write("gps-status", { message: "Fără confirmare • verifică internetul. Punctele nesincronizate nu sunt păstrate." });
  } finally { sending = false; }
});
