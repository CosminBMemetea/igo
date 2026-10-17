// Harta live pentru firmele reale: din pozițiile trimise de telefonul șoferului în tură (nu din demo).
import type { LiveVehicle } from "./query";
import type { Vehicle } from "./fleet/seed";
import { truckToday } from "./driver-log";
import { positionEpoch } from "./truck-history";
import { localNow } from "./validate";
import { haversineKm as hav2 } from "./fleet/data";
type Repo = { shift(id: string): Promise<{ start: string; end: string | null; privateSince?: string | null } | null> };
export const nowMin = () => { const l = localNow(); return Number(l.slice(11, 13)) * 60 + Number(l.slice(14, 16)); };
export async function realLive(firmId: string, repo: Repo, vehicles: Vehicle[]): Promise<LiveVehicle[]> {
  return Promise.all(vehicles.map(async (v): Promise<LiveVehicle> => {
    const sh = await repo.shift(v.id), on = !!sh && !sh.end, priv = on && !!sh?.privateSince;
    const d = await truckToday(firmId, v.id, sh);
    const age = d.last ? Math.max(0, Math.round((Date.now() - positionEpoch(d.last)) / 1000)) : 1e9, tr = d.track, n = tr.length;
    const recentMove = n > 1 && Date.now() - tr[n - 1].timestamp <= 300000 && tr[n - 1].timestamp - tr[n - 2].timestamp <= 300000;
    const status: LiveVehicle["status"] = priv ? "private" : !on ? "offline" : age > 900 ? "offline" : recentMove ? "moving" : "stopped";
    return {
      id: v.id, name: v.name, kind: v.kind, driver: v.driver, status, speed: status === "moving" && n > 1 ? Math.min(130, Math.round(hav2(tr[n - 2].at, tr[n - 1].at) / (Math.max(1000, tr[n - 1].timestamp - tr[n - 2].timestamp) / 3600000))) : 0,
      at: priv || !d.last ? null : [d.last.lat, d.last.lng], secondsAgo: d.last ? Math.min(age, 86400) : 0,
      track: priv ? [] : tr, ahead: [], done: priv ? [] : tr.map((p) => p.at), dest: "", left: 0, leftUnit: "km", eta: null,
      today: d.km, todayUnit: "km", rate: v.baselineRate, rateUnit: "L/100km", profitToday: null, tripId: null, events: [], onShift: on,
    };
  }));
}
