import { logoutReceipt } from "@/lib/mobile-logout";
import { verifyMobileSession } from "@/lib/mobile-session";
import { notificationsFor } from "@/lib/notify";
import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { driverTripSummary, groupDriverTrips } from "@/lib/driver-trips";
import { localNow } from "@/lib/validate";
import { currentDocument, documentState, roadRegime, vehicleCompliance } from "@/lib/compliance";
import { driverProgress } from "@/lib/driver-progress";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const tn = await tenant();
  if (tn.demo || tn.role !== "driver" || !tn.uid || !tn.firm) return NextResponse.json({ error: "driver-required" }, { status: 403 });
  const s = store(), u = await s.userById(tn.uid);
  const allTrucks = await s.trucks(tn.firm.id);
  const truck = allTrucks.find(t => t.id === u?.truckId && !t.archivedAt);
  const shift = truck ? await s.shift(tn.firm.id, truck.id) : null;
  const today = localNow().slice(0, 10);
  const [allTrips, users, docs] = await Promise.all([s.trips(tn.firm.id), s.users(tn.firm.id), s.docs(tn.firm.id)]);
  const trips = allTrips.filter(t => t.driverId === tn.uid).map(driverTripSummary);
  const ownIds = new Set(trips.map(t => t.id));
  const paperwork = (await s.files(tn.firm.id, {})).filter(f => f.tripId && ownIds.has(f.tripId) && (f.kind === "cmr" || f.kind === "pod"))
    .map(f => ({ id: f.id, tripId: f.tripId, kind: f.kind, name: f.name, createdAt: f.createdAt }));
  // Only the current shift's recent truck positions, never a prior driver's history.
  const positions = truck && shift && !shift.end && !shift.privateSince
    ? await s.positions(tn.firm.id, [shift.start, new Date(Date.now() - 3600000).toISOString()].sort().at(-1)!, truck.id) : [];
  const last = positions.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && Number.isFinite(Date.parse(p.capturedAt ?? p.at)) && Date.parse(p.capturedAt ?? p.at) <= Date.now() + 5000)
    .sort((a, b) => (b.capturedAt ?? b.at).localeCompare(a.capturedAt ?? a.at))[0];
  // Same allowlist as the web Acte/Curse screens: plates only for trucks on the driver's own trips, own personal documents only.
  const tripTrucks = new Set(trips.map(t => t.truckId));
  const plates = Object.fromEntries(allTrucks.filter(t => tripTrucks.has(t.id)).map(t => [t.id, t.plate]));
  const personal = docs.filter(d => d.scope === "driver" && d.userId === tn.uid);
  const myDocs = [...new Set(personal.map(d => d.type))].map(type => currentDocument(personal.filter(d => d.type === type), today) ?? personal.find(d => d.type === type)!)
    .map(d => ({ type: d.type, state: documentState(d, today), expires: d.expires ?? null }));
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const mobile = token ? await verifyMobileSession(token, process.env.SESSION_SECRET) : null;
  return NextResponse.json({ ...(mobile && token ? { logoutReceipt: await logoutReceipt(token, mobile) } : {}), name: u?.name, phone: u?.phone ?? null, locale: u?.locale ?? null, firm: tn.firm.name, truck: truck ? { id: truck.id, plate: truck.plate } : null,
    road: truck ? { regime: roadRegime(truck.compliance), category: truck.compliance?.category ?? null, mtmaKg: truck.compliance?.mtmaKg ?? null, euro: truck.compliance?.euro ?? null,
      documents: vehicleCompliance(truck.compliance, docs.filter(d => d.truckId === truck.id && d.scope !== "driver"), today).filter(d => d.state !== "not-applicable").map(d => ({ type: d.type, state: d.state, expires: d.doc?.expires ?? null })) } : null,
    progress: driverProgress(users, allTrips, tn.uid, today),
    position: last ? { lat: last.lat, lng: last.lng, at: last.capturedAt ?? last.at, accuracy: last.accuracy ?? null } : null,
    alerts: (await notificationsFor(tn)).map(n => ({ id: n.id, kind: n.kind, label: n.params.label, type: n.params.type, expires: n.params.expires })),
    shift, paperwork, plates, myDocs, trips: groupDriverTrips(trips, today), serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } });
}
