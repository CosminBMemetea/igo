import { applyDemoEcon } from "./econ-store";
import { demoLive } from "./live-sync";
// Încărcare comună pentru pagini (server): datele firmei curente (demo sau reală).
import { realLive } from "./real-live";
import { tenant } from "./tenant";
import { liveFleet, tripViews } from "./query";
export async function load() {
  const tn = await tenant();
  const r = tn.repo;
  const [v0, t0, clients, parcels, zones, alerts0] = await Promise.all([r.vehicles(), r.trips(), r.clients(), r.parcels(), r.zones(), r.alerts()]);
  const { vehicles: allVehicles, trips } = tn.demo ? applyDemoEcon(v0, t0) : { vehicles: v0, trips: t0 };
  // camioanele scoase din flotă: istoricul rămâne (pagina camionului), dar nu intră în calcule, hartă sau alerte
  const vehicles = allVehicles.filter((v) => !v.archived), archived = allVehicles.filter((v) => v.archived);
  const views = tripViews(trips, vehicles), archivedViews = archived.length ? tripViews(trips, allVehicles).filter((x) => x.vehicle.archived) : [];
  const alerts = archived.length ? alerts0.filter((a) => !archived.some((v) => v.id === (a as { vehicleId?: string }).vehicleId)) : alerts0;
  // firmele reale n-au încă GPS: harta live rămâne goală până la conectarea unei surse
  return { tn, demo: tn.demo, vehicles, allVehicles, archivedViews, trips, clients, parcels, zones, alerts, views, live: async () => (tn.demo ? demoLive(vehicles, views, parcels, zones) : tn.firm ? realLive(tn.firm.id, r, vehicles) : []) };
}
