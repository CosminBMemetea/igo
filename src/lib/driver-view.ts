// Datele ecranelor de șofer (Acasă / Curse / Acte / Profil), filtrate pe server ÎNAINTE de serializare:
// un șofer vede doar cursele, pozele și actele lui; demo-ul folosește camionul demo și nume fictive.
import "server-only";
import { cache } from "react";
import { store } from "./store";
import type { Tenant } from "./tenant";
import { activeFleet } from "./econ-store";
import { todayFor } from "./today";
import { driverTripSummary, type DriverTripSummary } from "./driver-trips";
import { paperworkFor } from "./paperwork";
import { currentDocument, documentState, type ComplianceState } from "./compliance";
import { docStatus } from "./docs";
import { missingDocs, type TripDocs } from "./driver-checklist";

const BAD_PERSONAL: ComplianceState[] = ["expired", "missing", "unknown"];
const SOON_PERSONAL: ComplianceState[] = ["urgent", "soon"];

async function load(tn: Tenant, vParam?: string) {
  const isDriver = tn.role === "driver", s = store();
  const me = tn.uid && tn.firm ? await s.userById(tn.uid) : null;
  const allVehicles = await tn.repo.vehicles();
  const vehicles = (await activeFleet(tn.demo, allVehicles)).vehicles.filter(v => !isDriver || tn.demo || v.id === me?.truckId);
  const vehicle = vehicles.find(x => x.id === vParam) ?? vehicles.find(x => x.id === me?.truckId) ?? vehicles[0] ?? null;
  const today = todayFor(tn.demo);
  let trips: DriverTripSummary[] = [];
  const docs: Record<string, TripDocs> = {};
  if (!tn.demo && tn.firm) {
    const firmId = tn.firm.id;
    // șofer: doar cursele lui (orice camion); patron în previzualizare: cursele camionului ales
    trips = (await s.trips(firmId)).filter(x => isDriver ? x.driverId === tn.uid : x.truckId === vehicle?.id).map(driverTripSummary);
    const ids = new Set(trips.map(x => x.id));
    for (const f of await s.files(firmId, {})) {
      if (!f.tripId || !ids.has(f.tripId) || (f.kind !== "cmr" && f.kind !== "pod")) continue;
      (docs[f.tripId] ??= { cmr: 0, pod: 0 })[f.kind]++;
    }
  } else if (tn.demo && vehicle) {
    const clients = new Map((await tn.repo.clients()).map(x => [x.id, x.name]));
    trips = (await tn.repo.trips()).filter(x => x.vehicleId === vehicle.id).map(x => driverTripSummary({ id: x.id, truckId: x.vehicleId, client: clients.get(x.clientId) ?? "", title: x.title, date: x.date, planned: x.planned ?? x.active, loadedAt: x.loadedAt, deliveredAt: x.deliveredAt, cancelledAt: x.cancelledAt, cancelReason: x.cancelReason, podReceived: !!x.deliveredAt || !x.active }));
    for (const t of trips) { const pw = await paperworkFor(tn, t.id); docs[t.id] = { cmr: pw.files.filter(f => f.kind === "cmr").length, pod: pw.files.filter(f => f.kind === "pod").length }; }
  }
  const driverName = vehicle?.driver || me?.name || "";
  const allDocs = await tn.repo.docs();
  const vehicleDocs = vehicle ? allDocs.filter(d => d.scope === "vehicle" && d.ownerId === vehicle.id) : [];
  const personal = allDocs.filter(d => d.scope === "driver" && (tn.demo ? d.ownerId === driverName : !!tn.uid && d.userId === tn.uid));
  const myDocs = [...new Set(personal.map(d => d.type))].map(type => currentDocument(personal.filter(d => d.type === type), today) ?? personal.find(d => d.type === type)!)
    .map(d => ({ ...d, state: documentState(d, today), days: docStatus(d.expires ?? "", today).days })).sort((a, b) => a.days - b.days);
  const tasks = !tn.demo && tn.firm && isDriver ? (await s.complianceTasks(tn.firm.id)).filter(task => task.driverId === tn.uid && task.truckId === me?.truckId) : [];
  const missing = missingDocs(trips, docs, today);
  const personalBad = myDocs.filter(d => BAD_PERSONAL.includes(d.state)).length, personalSoon = myDocs.filter(d => SOON_PERSONAL.includes(d.state)).length;
  return { isDriver, me: me ? { name: me.name, phone: me.phone, truckId: me.truckId ?? null } : null, allVehicles, vehicles, vehicle, today, trips, docs, driverName, vehicleDocs, myDocs, tasks, missing, personalBad, personalSoon, todo: missing.length + personalBad };
}
/** O singură încărcare per cerere (layout + pagină). */
export const driverView = cache(load);
export type DriverView = Awaited<ReturnType<typeof load>>;
