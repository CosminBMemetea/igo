import { getPrefs } from "@/lib/prefs";
import { demoDelta, shiftDeep, shiftStr } from "@/lib/demo-time";
import { t, tri, type MsgKey } from "@/lib/i18n";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { demoReplay, firmReplay } from "@/lib/replay";
import { TRUCKS } from "@/lib/fleet/data";
import ReplayMap from "@/components/ReplayMap";
import { tripView } from "@/lib/query";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { dayReplayWindow, tripReplayWindow } from "@/lib/truck-history";

export const dynamic = "force-dynamic";
const RK = ["unknownTank", "fuelNote", "demoTank", "dayStart", "tank", "sumTitle", "hours", "normal", "profit", "again", "hl", "hlHint", "title", "back", "play", "pauseBtn", "scrub", "follow", "time", "km", "litres", "fueled", "stops", "events", "fuel", "pause", "private", "privShort", "privNote", "start", "end", "openTrip", "st_drive", "st_pause", "st_fuel", "st_private", "st_end"] as const;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });

export default async function Replay({ searchParams }: { searchParams: { v?: string; trip?: string; d?: string; autoplay?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const tn = await tenant();
  const r = tn.repo;
  const [vehicles, trips] = await Promise.all([r.vehicles(), r.trips()]);
  const trip = searchParams.trip ? trips.find((x) => x.id === searchParams.trip) ?? null : null;
  if (searchParams.trip && !trip) notFound();
  const vid = trip?.vehicleId ?? searchParams.v ?? (tn.demo ? "bh21qrt" : vehicles[0]?.id);
  const v = vehicles.find((x) => x.id === vid);
  if (searchParams.v && (!v || (trip && trip.vehicleId !== searchParams.v))) notFound();
  if (v && !trip && !searchParams.d) redirect(`/vehicles/${v.id}/history`);
  const window = trip ? tripReplayWindow(trip) : dayReplayWindow(searchParams.d ?? today());
  const historyMonth = trip?.date.slice(0, 7) ?? window?.date.slice(0, 7);
  const history = v ? `/vehicles/${v.id}/history${historyMonth ? `?month=${historyMonth}` : ""}` : "/trucks";
  const L = Object.fromEntries(RK.map((k) => [k, t(loc, `rp.${k}` as MsgKey)]));
  // Position gaps do not reveal whether the driver enabled privacy mode.
  if (!tn.demo) {
    for (const k of ["private", "privShort", "st_private"]) L[k] = t(loc, "rp.gap");
    L.privNote = t(loc, "rp.gapNote");
    L.start = tri(loc, "Primul punct GPS|First GPS point|Pierwszy punkt GPS");
    L.end = tri(loc, "Ultimul punct GPS|Last GPS point|Ostatni punkt GPS");
    L.st_end = tri(loc, "Sfârșitul datelor GPS|End of GPS data|Koniec danych GPS");
    L.scrub = tri(loc, "Ora din intervalul GPS|Time in GPS period|Czas w okresie GPS");
  }
  const back = trip ? `/trips/${trip.id}` : history;
  const simulatedTrip = !!(tn.demo && trip && !trip.cancelledAt && (trip.loadedAt || trip.deliveredAt || !(trip.planned ?? trip.active)));
  const tripScope = !!(trip && (window?.kind === "trip" || simulatedTrip));
  L.title = tripScope ? tri(loc, "GPS din cursă|Trip GPS|GPS kursu") : tri(loc, "GPS-ul zilei|Day GPS|GPS dnia");
  L.scopeLabel = tri(loc, "Ce arată GPS-ul|GPS scope|Zakres GPS");
  L.history = tri(loc, "Alege altă cursă|Choose another trip|Wybierz inny kurs");
  L.scopeNote = tn.demo ? tri(loc, "Traseu simulat pentru demonstrație.|Simulated route for demonstration.|Trasa symulowana na potrzeby demonstracji.") : tripScope
    ? tri(loc, "Doar punctele GPS din intervalul încărcare–descărcare (sau până acum). Precizia orelor salvate: un minut.|Only GPS points between loading and unloading (or now). Stored time precision: one minute.|Tylko punkty GPS między załadunkiem a rozładunkiem (lub teraz). Dokładność zapisanego czasu: jedna minuta.")
    : tri(loc, "Toate deplasările camionului din această zi. Pot include mai multe curse; nu sunt atribuite unei singure curse.|All truck movements on this day. They may include several trips and are not assigned to a single trip.|Wszystkie przejazdy pojazdu w tym dniu. Mogą obejmować kilka kursów i nie są przypisane do jednego kursu.");
  if (!window && !simulatedTrip) {
    L.title = tri(loc, "GPS indisponibil|GPS unavailable|GPS niedostępny");
    L.scopeNote = trip?.cancelledAt ? tri(loc, "Cursa este anulată.|This trip is cancelled.|Ten kurs jest anulowany.") : tri(loc, "Cursa nu are încă un interval GPS de redat.|This trip does not yet have a GPS period to replay.|Ten kurs nie ma jeszcze okresu GPS do odtworzenia.");
  }
  if (window && tripScope && !tn.demo) L.scopeNote += ` ${window.from.replace("T", " ")} → ${window.until.replace("T", " ")}.`;
  if (window && tripScope && window.from.slice(0, 10) !== window.until.slice(0, 10)) L.scopeNote += " " + tri(loc, "(+1), (+2) indică zilele după data de început.|(+1), (+2) indicate days after the start date.|(+1), (+2) oznaczają dni po dacie rozpoczęcia.");
  let data = null;
  if (tn.demo && (window || simulatedTrip) && TRUCKS.some(x => x.id === vid)) { const k = demoDelta(); data = shiftDeep(demoReplay(vid!, shiftStr(trip?.date ?? window?.date ?? today(), -k), trip?.id ?? null), k); }
  else if (v && tn.firm && window) {
    const s = store();
    const [pos, fuel] = await Promise.all([s.positions(tn.firm.id, window.from, v.id, window.until), s.fuel(tn.firm.id, { truckId: v.id, limit: 5000 })]);
    data = firmReplay({ vehicleId: v.id, plate: v.name, driver: tripScope ? trip?.driverName ?? "" : "", date: window.date, tripId: tripScope ? trip!.id : null, route: tripScope ? trip!.title : "", rate: v.baselineRate || 30, pos, fuel, window });
  }
  const rv = vehicles.find((x) => x.id === data?.vehicleId) ?? null;
  const rt = data?.tripId ? trips.find(x => x.id === data.tripId) ?? null : null;
  if (!data) return (
    <main className="setup">
      <div className="eyebrow">{L.title}</div>
      <h1 className="h1">{v?.name ?? "—"}</h1>
      <p className="sub">{trip?.title ?? window?.date ?? searchParams.d}</p>
      <p className="sub">{L.scopeNote}</p>
      <div className="msg warn" style={{ marginTop: 18 }}>{t(loc, "rp.none")}</div>
      <p className="gdpr"><b>GDPR</b> · {t(loc, "priv.gdpr")}</p>
      <Link className="btn sec" href={back} style={{ marginTop: 18 }}>{L.back}</Link>
      <Link className="btn sec" href={history} style={{ margin: "18px 0 0 10px" }}>{L.history}</Link>
      {!vehicles.length ? <EmptyState kind="live" loc={loc} canSetup={tn.role === "owner" || tn.role === "admin"} /> : null}
    </main>
  );
  return (
    <main className="live-page rp-page" style={{ padding: 0 }}>
      <ReplayMap key={`${data.vehicleId}:${data.tripId}:${data.date}`} data={data} theme={prefs.theme} loc={loc} L={L} back={back} history={history} autoplay={searchParams.autoplay === "1"} extra={{ normal: rv?.baselineRate ?? null, tank: rv?.tankL ?? null, profit: rt ? tripView(rt, vehicles).p.profit : null }} />
    </main>
  );
}
