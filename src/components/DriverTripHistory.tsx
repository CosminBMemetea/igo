import Link from "next/link";
import { tri, fmtDate, type Locale } from "@/lib/i18n";
import type { Trip } from "@/lib/fleet/seed";
export function DriverTripHistory({ trips, loc }: { trips: Trip[]; loc: Locale }) {
  if (!trips.length) return null;
  return <section className="section"><h2 className="h2">{tri(loc, "Curse livrate · CMR și POD|Delivered trips · CMR and POD|Dostarczone kursy · CMR i POD")}</h2>
    <div className="list">{[...trips].sort((a,b) => b.date.localeCompare(a.date)).map(x => <Link className="it" key={x.id} href={`/driver/trips/${encodeURIComponent(x.id)}`}><div style={{ minWidth: 0 }}><div className="t">{x.title}</div><div className="m">{fmtDate(loc, x.date)} · {tri(loc, "Deschide documentele|Open documents|Otwórz dokumenty")}</div></div></Link>)}</div>
  </section>;
}
