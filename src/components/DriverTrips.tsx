import Link from "next/link";
import { tri, fmtDate, type Locale } from "@/lib/i18n";
import { groupDriverTrips, type DriverTripStage } from "@/lib/driver-trips";
import type { TripRow } from "@/lib/store/types";
const labels: Record<DriverTripStage, string> = {
  running: "În desfășurare|In progress|W trakcie",
  ready: "De preluat|Ready to start|Do rozpoczęcia",
  upcoming: "Urmează|Upcoming|Nadchodzące",
  documents: "De trimis POD|POD needed|Brakuje POD",
  finished: "Finalizate|Completed|Zakończone",
  cancelled: "Anulate|Cancelled|Anulowane",
};
export function DriverTrips({ trips, today, truckId, trucks, loc }: { trips: TripRow[]; today: string; truckId?: string | null; trucks: { id: string; name: string }[]; loc: Locale }) {
  const groups = groupDriverTrips(trips, today);
  return <section className="driver-trips" aria-labelledby="my-trips-title"><div className="driver-trips-heading"><h2 className="h2" id="my-trips-title">{tri(loc, "Cursele mele|My trips|Moje kursy")}</h2><span className="sub">{trips.length}</span></div>
    {!trips.length ? <p className="sub">{tri(loc, "Nu ai curse atribuite. Vor apărea aici când le alocă patronul.|Your assigned trips will appear here.|Przypisane kursy pojawią się tutaj.")}</p> : null}
    {(Object.keys(groups) as DriverTripStage[]).filter(stage => groups[stage].length).map(stage => {
      const rows = <div className="driver-trip-list">{groups[stage].map(x => <Link key={x.id} className="driver-trip-card" href={!x.cancelledAt && !x.deliveredAt && x.planned && x.truckId === truckId ? `/driver?trip=${encodeURIComponent(x.id)}#trip-paperwork` : `/driver/trips/${encodeURIComponent(x.id)}`}>
        <div className="driver-trip-meta"><span>{fmtDate(loc, x.date, true)}</span>{stage === "ready" && x.date < today ? <span className="badge warn">{tri(loc, "Dată depășită|Past scheduled date|Po terminie")}</span> : null}</div>
        <strong>{x.title}</strong><span className="sub">{[trucks.find(v => v.id === x.truckId)?.name, x.client].filter(value => value && value !== "—").join(" · ")}</span>
        {!x.cancelledAt && !x.deliveredAt && x.planned && x.truckId !== truckId ? <span className="driver-trip-warning">{tri(loc, "Camion diferit de cel alocat · contactează patronul|Different truck assigned · contact the owner|Inny przypisany pojazd · skontaktuj się z właścicielem")}</span> : null}
        {x.cancelledAt && x.cancelReason ? <span className="sub">{x.cancelReason}</span> : null}
        <span className="driver-trip-open">{tri(loc, stage === "documents" ? "Trimite dovada livrării →|Send delivery proof →|Wyślij potwierdzenie dostawy →" : "Deschide cursa →|Open trip →|Otwórz kurs →")}</span>
      </Link>)}</div>;
      return stage === "finished" || stage === "cancelled" ? <details className="driver-trip-group" key={stage}><summary>{tri(loc, labels[stage])} · {groups[stage].length}</summary>{rows}</details> : <section className="driver-trip-group" key={stage}><h2 className="eyebrow">{tri(loc, labels[stage])} · {groups[stage].length}</h2>{rows}</section>;
    })}
  </section>;
}
