import { demoLive } from "./live-sync";
// Încărcare comună pentru pagini (server): datele firmei curente (demo sau reală).
import { tenant } from "./tenant";
import { liveFleet, tripViews } from "./query";
export async function load() {
  const tn = await tenant();
  const r = tn.repo;
  const [vehicles, trips, clients, parcels, zones, alerts] = await Promise.all([r.vehicles(), r.trips(), r.clients(), r.parcels(), r.zones(), r.alerts()]);
  const views = tripViews(trips, vehicles);
  // firmele reale n-au încă GPS: harta live rămâne goală până la conectarea unei surse
  return { tn, demo: tn.demo, vehicles, trips, clients, parcels, zones, alerts, views, live: () => (tn.demo ? demoLive(vehicles, views, parcels, zones) : []) };
}
