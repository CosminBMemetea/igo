import { store } from "@/lib/store";
import { driverTruck } from "@/lib/driver-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tenant } from "@/lib/tenant";
import { getPrefs } from "@/lib/prefs";
import { tri, t, fmtDate } from "@/lib/i18n";
import { paperworkFor } from "@/lib/paperwork";
import { PW } from "@/lib/paperwork-labels";
import { TripPaperwork } from "@/components/TripPaperwork";
import { DriverOutbox } from "@/components/DriverOutbox";
export const dynamic = "force-dynamic";
export default async function DriverDocuments(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tn = await tenant(), { loc } = (await getPrefs());
  if (tn.demo || tn.role !== "driver" || !tn.firm || !tn.uid) notFound();
  const trip = (await tn.repo.trips()).find(x => x.id === params.id && x.driverId === tn.uid);
  if (!trip) notFound();
  const pw = await paperworkFor(tn, trip.id), now = Date.now(), scope = `${tn.firm.id}:${tn.uid}`;
  const canOperate = !trip.cancelledAt && !!trip.planned && (await driverTruck(store(), tn, trip.vehicleId));
  const shift = canOperate ? await tn.repo.shift(trip.vehicleId) : null;
  const vehicle = (await tn.repo.vehicles()).find(v => v.id === trip.vehicleId);
  const hint = trip.cancelledAt ? "Cursă anulată. Nu mai înregistra activități pentru această cursă.|Cancelled trip. No further activities can be recorded.|Kurs anulowany. Nie można rejestrować kolejnych działań."
    : trip.deliveredAt ? "Livrare înregistrată. Verifică CMR-ul și trimite dovada livrării (POD).|Delivery recorded. Check the CMR and send delivery proof (POD).|Dostawa zapisana. Sprawdź CMR i wyślij POD."
    : !canOperate ? "Cursa poate fi consultată. Pentru înregistrarea activităților, cere patronului să verifice planificarea și camionul alocat.|View only. Ask the owner to check the trip plan and assigned truck before recording activities.|Tylko podgląd. Poproś właściciela o sprawdzenie planu i przypisanego pojazdu."
    : trip.loadedAt ? "Ai încărcat. La destinație, înregistrează descărcarea și trimite POD-ul.|Loaded. At the destination, record unloading and send the POD.|Załadowano. Na miejscu zapisz rozładunek i wyślij POD."
    : "Verifică ruta și data. Înregistrează încărcarea doar când ai încărcat efectiv.|Check the route and date. Record loading only when the truck is actually loaded.|Sprawdź trasę i datę. Zapisz załadunek dopiero po jego wykonaniu.";
  return <main className="driver-main"><Link className="btn sec" href="/driver">{tri(loc, "Înapoi|Back|Wstecz")}</Link><DriverOutbox scope={scope} loc={loc} />
    <div className="driver-trip-context"><p className="eyebrow">{vehicle?.name}</p><p>{tri(loc, hint)}</p>{trip.cancelledAt && trip.cancelReason ? <p>{trip.cancelReason}</p> : null}</div>
    <TripPaperwork key={trip.id} queueScope={scope} actorId={tn.uid} readOnly={!!trip.cancelledAt || (!trip.deliveredAt && !canOperate)} tripId={trip.id} title={`${trip.title} · ${fmtDate(loc, trip.date)}`} demo={false} onShift={!!shift && !shift.end && !shift.privateSince} serverNow={now} loc={loc}
      initial={{ loadedAt: pw.loadedAt, unloadedAt: pw.unloadedAt, waitMin: pw.waiting ? pw.waitMin - Math.round((now - Date.parse(pw.waitSince!)) / 60000) : pw.waitMin, waitSince: pw.waitSince, files: pw.files }}
      L={{ ...Object.fromEntries(PW.map(k => [k, t(loc, k)])), "pw.today": tri(loc, "Cursa și documentele|Trip and documents|Kurs i dokumenty") }} />
  </main>;
}
