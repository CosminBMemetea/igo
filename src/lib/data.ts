// Încărcare comună pentru pagini (server).
import { repo } from "./repo";
import { liveFleet, tripViews } from "./query";
export async function load() {
  const r = repo();
  const [vehicles, trips, clients, parcels, zones, alerts] = await Promise.all([r.vehicles(), r.trips(), r.clients(), r.parcels(), r.zones(), r.alerts()]);
  const views = tripViews(trips, vehicles);
  return { vehicles, trips, clients, parcels, zones, alerts, views, live: () => liveFleet(vehicles, views, parcels, zones) };
}
