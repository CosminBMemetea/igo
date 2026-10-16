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
export default async function DriverDocuments({ params }: { params: { id: string } }) {
  const tn = await tenant(), { loc } = getPrefs();
  if (tn.demo || tn.role !== "driver" || !tn.firm || !tn.uid) notFound();
  const trip = (await tn.repo.trips()).find(x => x.id === params.id && x.driverId === tn.uid && !!x.deliveredAt && !x.cancelledAt);
  if (!trip) notFound();
  const pw = await paperworkFor(tn, trip.id), now = Date.now(), scope = `${tn.firm.id}:${tn.uid}`;
  return <main className="driver-main"><Link className="btn sec" href="/driver">{tri(loc, "Înapoi|Back|Wstecz")}</Link><DriverOutbox scope={scope} loc={loc} />
    <TripPaperwork key={trip.id} queueScope={scope} actorId={tn.uid} readOnly={false} tripId={trip.id} title={`${trip.title} · ${fmtDate(loc, trip.date)}`} demo={false} onShift={false} serverNow={now} loc={loc}
      initial={{ loadedAt: pw.loadedAt, unloadedAt: pw.unloadedAt, waitMin: pw.waiting ? pw.waitMin - Math.round((now - Date.parse(pw.waitSince!)) / 60000) : pw.waitMin, waitSince: pw.waitSince, files: pw.files }}
      L={{ ...Object.fromEntries(PW.map(k => [k, t(loc, k)])), "pw.today": tri(loc, "Documentele cursei livrate|Delivered trip documents|Dokumenty dostarczonego kursu") }} />
  </main>;
}
