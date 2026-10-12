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
  // km de azi rămân cei parcurși ÎNAINTE de pauză (ca pe ecranul șoferului); doar poziția/viteza dispar
  const open = new Map(liveFleet(vehicles, views, parcels, zones, now, new Set()).map((x) => [x.id, x]));
  return liveFleet(vehicles, views, parcels, zones, now, priv).map((x) => {
    if (x.status === "private" && ds[x.id]?.privateSince) return { ...x, today: open.get(x.id)?.today ?? x.today, todayUnit: open.get(x.id)?.todayUnit ?? x.todayUnit };
    return ds[x.id]?.end ? liveSyncNote(x) : x;
  });
}
