// Demo în același browser: starea șoferului demo (cookie „qf-dshift”) se vede și pe harta patronului.
// Pauză privată → „Privat”, fără poziție (GDPR); tură încheiată → camion oprit.
import { DEMO_NOW_MIN } from "./fleet/data";
import { DEMO_PRIVATE, liveFleet, liveSyncNote, type LiveVehicle } from "./query";
import { demoShifts } from "./demo-shift";
export function demoLive(...a: Parameters<typeof liveFleet>): LiveVehicle[] {
  const [vehicles, views, parcels, zones, now = DEMO_NOW_MIN] = a;
  const ds = demoShifts();
  const priv = new Set(DEMO_PRIVATE);
  for (const [id, s] of Object.entries(ds)) { if (s.privateSince && !s.end) priv.add(id); else priv.delete(id); }
  return liveFleet(vehicles, views, parcels, zones, now, priv).map((x) => (ds[x.id]?.end && x.status !== "private" ? liveSyncNote(x) : x));
}
