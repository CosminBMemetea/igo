import Link from "next/link";
import { notFound } from "next/navigation";
import { tenant } from "@/lib/tenant";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, tri } from "@/lib/i18n";
import { localNow } from "@/lib/validate";
import { store } from "@/lib/store";
import { replayQueryBounds, tripReplayWindow, windowPositions } from "@/lib/truck-history";
import type { Trip } from "@/lib/fleet/seed";
export const dynamic = "force-dynamic";

export default async function TruckHistory(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const tn = await tenant(), { loc } = (await getPrefs()), tr = (s: string) => tri(loc, s), today = localNow().slice(0, 10);
  const [vehicles, allTrips, clients] = await Promise.all([tn.repo.vehicles(), tn.repo.trips(), tn.repo.clients()]);
  const vehicle = vehicles.find(v => v.id === params.id);if (!vehicle) notFound();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? "") ? searchParams.month! : today.slice(0, 7);
  const trips = allTrips.filter(t => t.vehicleId === vehicle.id && t.date.startsWith(month));
  const windows = trips.map(t => tripReplayWindow(t)).filter(w => w !== null);
  const bounds = windows.map(replayQueryBounds);
  const from = bounds.map(w => w.from).sort()[0], until = bounds.map(w => w.until).sort().at(-1);
  const positions = !tn.demo && tn.firm && from && until ? await store().positions(tn.firm.id, from, vehicle.id, until) : [];
  const names = new Map(clients.map(c => [c.id, c.name]));
  const group = (t: Trip) => t.cancelledAt || t.deliveredAt || !(t.planned ?? t.active) ? "history" : t.loadedAt ? "current" : "planned";
  const groups = [
    { id: "current", label: tr("În desfășurare|In progress|W trakcie") },
    { id: "planned", label: tr("Planificate|Planned|Zaplanowane") },
    { id: "history", label: tr("Istoric|History|Historia") },
  ];
  const monthLink = (delta: number) => { const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta); return `?month=${d.toISOString().slice(0, 7)}`; };
  return <main className="truck-history">
    <Link className="link" href={`/vehicles/${vehicle.id}`}>← {vehicle.name}</Link>
    <h1 className="h1">{tr("Curse și trasee|Trips and routes|Kursy i trasy")}</h1>
    <p className="sub">{tr("Alege cursa camionului după dată și traseu. GPS-ul unei zile poate include mai multe curse.|Choose the truck’s trip by date and route. A day’s GPS may include several trips.|Wybierz kurs pojazdu według daty i trasy. GPS z jednego dnia może obejmować kilka kursów.")}</p>
    <form key={month} method="get" className="truck-history-filter">
      <label className="lf"><span>{tr("Luna plecării|Departure month|Miesiąc wyjazdu")}</span><input type="month" name="month" required defaultValue={month} /></label>
      <button className="btn pri">{tr("Arată cursele|Show trips|Pokaż kursy")}</button>
      <Link className="btn sec" href={monthLink(-1)} aria-label={tr("Luna anterioară|Previous month|Poprzedni miesiąc")}>←</Link>
      <Link className="btn sec" href={monthLink(1)} aria-label={tr("Luna următoare|Next month|Następny miesiąc")}>→</Link>
    </form>
    {tn.demo ? <p className="msg warn">{tr("Demo: cursele și traseele sunt simulări, fără GPS de la șoferi reali.|Demo: trips and routes are simulations, without real driver GPS.|Demo: kursy i trasy są symulowane, bez GPS prawdziwych kierowców.")}</p> : null}
    {groups.map(g => {
      const rows = trips.filter(t => group(t) === g.id).sort((a, b) => g.id === "planned" ? a.date.localeCompare(b.date) : (b.loadedAt ?? b.date).localeCompare(a.loadedAt ?? a.date));
      if (!rows.length) return null;
      return <section key={g.id} className="truck-history-group"><h2>{g.label} <span>{rows.length}</span></h2>
        <div className="truck-history-list">{rows.map(t => {
          const window = tripReplayWindow(t), simulation = tn.demo && !t.cancelledAt && (!!t.loadedAt || !!t.deliveredAt || !(t.planned ?? t.active));
          const hasGPS = !!window && windowPositions(positions, vehicle.id, window).length >= 2;
          const href = simulation || window?.kind === "trip" ? `/replay?trip=${t.id}` : `/replay?v=${vehicle.id}&d=${t.date}`;
          return <article className="truck-history-trip" key={t.id}>
            <div className="truck-history-date">{fmtDate(loc, t.date, true)}<span className={`badge${t.cancelledAt ? " neg" : ""}`}>{t.cancelledAt ? tr("Anulată|Cancelled|Anulowany") : t.deliveredAt || !(t.planned ?? t.active) ? tr("Livrată|Delivered|Dostarczony") : t.loadedAt ? tr("Încărcată|Loaded|Załadowany") : tr("De încărcat|Awaiting loading|Do załadunku")}</span></div>
            <div className="truck-history-info"><h3><Link href={`/trips/${t.id}`}>{t.title}</Link></h3><p>{names.get(t.clientId) ?? "—"} · {t.driverName || tr("Șofer neînregistrat|Driver not recorded|Brak zapisanego kierowcy")}</p>
              {!tn.demo && window?.kind === "day" ? <small>{tr("Orele cursei lipsesc. GPS-ul zilei poate include și alte curse.|Trip times are missing. Day GPS may include other trips.|Brak godzin kursu. GPS dnia może obejmować inne kursy.")}</small> : null}
              {!tn.demo && window?.kind === "trip" ? <small>{window.from.replace("T", " ")} → {window.until.replace("T", " ")} · {tr("ora României|Romania time|czas rumuński")}</small> : null}
              {!simulation && !hasGPS ? <small>{t.cancelledAt ? tr("Cursa anulată nu se redă.|Cancelled trips cannot be replayed.|Anulowane kursy nie są odtwarzane.") : !window ? tr("GPS disponibil după începerea cursei.|GPS available after the trip starts.|GPS dostępny po rozpoczęciu kursu.") : tr("Fără suficiente puncte GPS în acest interval.|Not enough GPS points in this period.|Za mało punktów GPS w tym okresie.")}</small> : null}
            </div>
            <div className="truck-history-actions"><Link className="btn sec sm" href={`/trips/${t.id}`}>{tr("Detalii cursă|Trip details|Szczegóły kursu")}</Link>
              {simulation || hasGPS ? <Link className="btn pri sm" href={href}>{simulation ? tr("Simulare traseu|Route simulation|Symulacja trasy") : window?.kind === "trip" ? tr("GPS din cursă|Trip GPS|GPS kursu") : tr("GPS-ul zilei|Day GPS|GPS dnia")}</Link> : null}
            </div>
          </article>;
        })}</div>
      </section>;
    })}
    {!trips.length ? <p className="msg">{tr("Nicio cursă în luna aleasă. Schimbă luna sau verifică GPS-ul unei zile mai jos.|No trips in this month. Choose another month or check a day’s GPS below.|Brak kursów w tym miesiącu. Wybierz inny miesiąc lub sprawdź GPS dnia poniżej.")}</p> : null}
    <section className="sheet truck-history-day"><h2>{tr("GPS-ul camionului pe zi|Truck GPS by day|GPS pojazdu według dnia")}</h2><p className="sub">{tr("Include toate deplasările înregistrate în ziua aleasă, chiar dacă nu sunt legate de o cursă.|Includes all recorded movements on the selected day, including those outside a trip.|Obejmuje wszystkie zapisane przejazdy wybranego dnia, także poza kursem.")}</p>
      <form key={month} action="/replay" method="get" className="truck-history-filter"><input type="hidden" name="v" value={vehicle.id} /><label className="lf"><span>{tr("Ziua|Day|Dzień")}</span><input type="date" name="d" required defaultValue={month >= today.slice(0, 7) ? today : `${month}-01`} max={today} /></label><button className="btn sec">{tr("Vezi GPS-ul zilei|View day GPS|Zobacz GPS dnia")}</button></form>
    </section>
  </main>;
}
