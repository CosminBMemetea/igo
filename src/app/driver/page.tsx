import { TollRoHandoff } from "@/components/TollRoHandoff";
import { PW } from "@/lib/paperwork-labels";
import { defaultDriverTrip, driverTripStage, driverTripSummary } from "@/lib/driver-trips";
import { DriverTrips } from "@/components/DriverTrips";
import { demoWorkMs } from "@/lib/demo-work";
import { DriverOutbox } from "@/components/DriverOutbox";
import { DemoSwitcher } from "@/components/DemoSwitcher";
import { activeFleet } from "@/lib/econ-store";
import { liveFleet, tripViews } from "@/lib/query";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import { demoLastFill, demoReactions, demoShift } from "@/lib/demo-shift";
import { FT } from "@/lib/feed-i18n";
import { store } from "@/lib/store";
import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { tri, fmtDate, fmtNum, t, type MsgKey, plural } from "@/lib/i18n";
import { Gate } from "@/components/Gate";
import { truckToday } from "@/lib/driver-log";
import { DriverApp } from "@/components/DriverApp";
import { TripPaperwork } from "@/components/TripPaperwork";
import { paperworkFor } from "@/lib/paperwork";
import { docStatus, STATUS_CLASS } from "@/lib/docs";
import { roIso } from "@/lib/demo-time";
import { todayFor } from "@/lib/today";

export const dynamic = "force-dynamic";
const KEYS: MsgKey[] = ["drv.truckQ", "drv.truckChange", "priv.trackingWait", "priv.trackingOff", "priv.trackingOffHint", "drv.endQ", "drv.endTxt", "drv.endYes", "drv.endNo", "drv.vehicle", "drv.kmToday", "drv.hoursToday", "drv.start", "drv.stop", "drv.onShift", "drv.offShift", "drv.check", "drv.checkNeeded", "chk.tyres", "chk.fluids", "chk.docs", "chk.damage", "drv.fill", "drv.photo", "drv.photoHint", "drv.reading", "drv.sample", "drv.tooBig", "drv.notImage", "drv.notReceipt", "drv.litresRange", "drv.odoRange", "drv.sending", "drv.dup", "drv.readMeta", "drv.read", "drv.readManual", "drv.litres", "drv.odo", "drv.amount", "drv.fxOk", "drv.fxNo", "drv.cur", "drv.station", "drv.send", "drv.sent", "drv.lastFill", "drv.consent", "drv.gpsOff", "drv.invalid", "drv.role", "drv.preview", "drv.previewHint", "drv.previewNo", "priv.on", "priv.break", "priv.offShift", "priv.tracking", "priv.trackingHint", "priv.toggle", "priv.resume", "priv.geoOff"];

export default async function Driver(props: { searchParams: Promise<{ v?: string; trip?: string }> }) {
  const searchParams = await props.searchParams;
  const prefs = (await getPrefs()), { loc } = prefs;
  const tn = await tenant(), r = tn.repo;
  const queueScope = !tn.demo && tn.role === "driver" && tn.firm && tn.uid ? `${tn.firm.id}:${tn.uid}` : undefined;
  const outbox = queueScope ? <DriverOutbox scope={queueScope} loc={loc} /> : null;
  const me = tn.uid && tn.firm ? await store().userById(tn.uid) : null;
  const allVehicles = await r.vehicles();
  const realTrips = !tn.demo && tn.firm ? (await store().trips(tn.firm.id)).filter(x => tn.role !== "driver" || x.driverId === tn.uid) : [];
  const history = !tn.demo && tn.role === "driver" ? <DriverTrips trips={realTrips.map(driverTripSummary)} today={todayFor(false)} truckId={me?.truckId} trucks={allVehicles.map(x => ({ id: x.id, name: x.name }))} loc={loc} /> : null;
  const vehicles = (await activeFleet(tn.demo, allVehicles)).vehicles.filter((v) => tn.role !== "driver" || tn.demo || v.id === me?.truckId);
  if (!vehicles.length && tn.role === "driver" && !tn.demo) return <main className="driver-main">{outbox}<h1 className="h1">{tri(loc, "Camion nealocat|No truck assigned|Nie przypisano pojazdu")}</h1><p className="sub">{tri(loc, "Contul tău este activ. Cere patronului să îți asocieze camionul din pagina Șoferi.|Your account is active. Ask the owner to assign your truck from Drivers.|Twoje konto jest aktywne. Poproś właściciela o przypisanie pojazdu na stronie Kierowcy.")}</p>{history}</main>;
  if (!vehicles.length) return <main><EmptyState kind={tn.role === "driver" ? "driver" : "driverOwner"} loc={loc} canSetup={tn.role !== "driver"} /></main>;
  const v = vehicles.find((x) => x.id === searchParams.v) ?? vehicles.find((x) => x.id === me?.truckId) ?? vehicles[0];
  const fd = await r.fleetData();
  const last = [...(await r.driverFills(v.id))].pop();
  const lastCard = fd.fills.filter((f) => f.truckId === v.id).pop();
  const dl = tn.demo ? (await demoLastFill(v.id)) : null;
  const lastFill = dl ? `${fmtNum(loc, dl.litres, dl.litres % 1 ? 1 : 0)} L · ${dl.station || "—"}` : last ? `${last.litres} L · ${last.station || "—"}` : lastCard ? `${lastCard.litres} L · ${lastCard.station}` : "—";
  const claps = tn.demo ? (await demoReactions()).filter((x) => x.v === v.id) : [];
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(loc, k)]));
  const today = todayFor(tn.demo);
  const all = (await r.trips()).filter(x => tn.role !== "driver" || tn.demo || x.driverId === tn.uid);
  const clients = new Map((await r.clients()).map(x => [x.id, x.name]));
  const boardTrips = tn.demo ? all.filter(x => x.vehicleId === v.id).map(x => driverTripSummary({ id: x.id, truckId: x.vehicleId, client: clients.get(x.clientId) ?? "", title: x.title, date: x.date, planned: x.planned ?? x.active, loadedAt: x.loadedAt, deliveredAt: x.deliveredAt, cancelledAt: x.cancelledAt, cancelReason: x.cancelReason, podReceived: !!x.deliveredAt || !x.active })) : realTrips.map(driverTripSummary);
  const selectedId = searchParams.trip ?? defaultDriverTrip(boardTrips, today, v.id)?.id;
  const trip = all.find(x => x.id === selectedId && (!tn.demo || x.vehicleId === v.id));
  const selected = boardTrips.find(x => x.id === trip?.id);
  const stage = selected ? driverTripStage(selected, today) : null;
  const heading = tri(loc, stage === "running" ? "Cursa în desfășurare · acțiuni|Current trip · actions|Bieżący kurs · działania" : stage === "upcoming" ? "Cursă viitoare · planificată|Upcoming trip · scheduled|Nadchodzący kurs · zaplanowany" : stage === "documents" || stage === "finished" ? "Cursă livrată · documente|Delivered trip · documents|Dostarczony kurs · dokumenty" : stage === "cancelled" ? "Cursă anulată|Cancelled trip|Anulowany kurs" : "De încărcat · acțiuni|Ready for loading · actions|Do załadunku · działania");
  const pw = trip ? await paperworkFor(tn, trip.id) : null;
  const shift0 = (tn.demo ? (await demoShift(v.id)) : null) ?? (await r.shift(v.id));
  // demo: o tură nu durează peste 12 h și nu începe în viitor (cookie de ieri / noaptea înainte de 05:30) → tură proaspătă, realistă (~2,5 h)
  const age = shift0 && !shift0.end ? Date.now() - Date.parse(shift0.start) : 0;
  const shift = tn.demo && shift0 && !shift0.end && (age < 0 || age > 12 * 3600e3 || Number.isNaN(age)) ? (() => { const st = new Date(Date.now() - 2.5 * 3600e3).toISOString(); return { ...shift0, start: st, privateSince: shift0.privateSince ? st : null }; })() : shift0;
  // demo: aceeași sursă ca harta live (liveFleet la minutul demo)
  const liveKm = tn.demo ? (liveFleet(vehicles, tripViews((await activeFleet(tn.demo, vehicles, await r.trips())).trips, vehicles), await r.parcels(), await r.zones(), DEMO_NOW_MIN).find((x) => x.id === v.id)?.today ?? 0) : null;
  const nowMs = Date.now();
  // firmă reală: km din pozițiile GPS filtrate de azi, ore = tură ∩ azi (Europe/Bucharest) minus pauzele private
  const todayReal = !tn.demo && tn.firm ? await truckToday(tn.firm.id, v.id, shift).then((x) => ({ km: x.km, hours: x.hours })).catch(() => null) : null;
  const driverName = v.driver || me?.name || "";
  const myDocs = (await r.docs()).filter((d) => d.expires && ((d.scope === "vehicle" && d.ownerId === v.id) || (d.scope === "driver" && (tn.demo ? d.ownerId === driverName : d.userId === tn.uid))))
    .map((d) => ({ ...d, st: docStatus(d.expires!, today) })).sort((a, b) => a.st.days - b.st.days);
  return (
    <Gate feature="driverApp" prefs={prefs}>
      <main className="driver-main">{outbox}{tn.demo && tn.role === "driver" ? <DemoSwitcher loc={loc} driver /> : null}{!tn.demo && vehicles.length > 1 && tn.role !== "driver" ? <div className="seg" style={{ marginBottom: 8, flexWrap: "wrap", width: "auto" }}>{vehicles.map((x) => <a key={x.id} href={`/driver?v=${x.id}`} className={x.id === v.id ? "on" : ""}>{x.name}</a>)}</div> : null}
        {claps.length ? <div className="drvclap fade" role="status"><span>👏</span><div><b>{FT[loc].clapDrv.replace("{n}", String(claps.length))}</b><small>{claps[claps.length - 1].l}</small></div></div> : null}
        <DriverTrips trips={boardTrips} today={today} truckId={v.id} trucks={allVehicles.map(x => ({ id: x.id, name: x.name }))} loc={loc} selectedId={trip?.id} embedded demo={tn.demo} />
        <div id="trip-paperwork">{trip && pw ? <TripPaperwork key={trip.id} clockOffset={tn.demo ? Date.parse(roIso(today, "14:00")) - nowMs : 0} queueScope={queueScope} actorId={tn.uid ?? undefined} readOnly={!!trip.cancelledAt || (!tn.demo && (tn.role !== "driver" || (!trip.deliveredAt && (!trip.planned || trip.vehicleId !== v.id))))} serverNow={nowMs} loc={loc} tripId={trip.id} title={`${trip.title} · ${fmtDate(loc, trip.date, true)}`} demo={tn.demo} onShift={!!shift && !shift.end && !shift.privateSince} initial={{ loadedAt: pw.loadedAt, unloadedAt: pw.unloadedAt, waitMin: pw.waiting ? pw.waitMin - Math.round((Date.now() - Date.parse(pw.waitSince!)) / 60000) : pw.waitMin, waitSince: pw.waitSince, files: pw.files }} L={{ ...Object.fromEntries(PW.map((k) => [k, t(loc, k)])), "pw.today": heading }} /> : (tn.demo || tn.role !== "driver") ? <p className="sub" style={{ marginTop: 32 }}>{t(loc, "pw.noTrip")}</p> : null}</div>
        {trip && !trip.cancelledAt ? <TollRoHandoff key={trip.id} plate={allVehicles.find(x => x.id === trip.vehicleId)?.name ?? "—"} route={trip.title} date={trip.date} loc={loc} demo={tn.demo} /> : null}
        <DriverApp key={tn.uid ?? "demo-driver"} queueScope={queueScope} actorId={tn.uid ?? undefined} preview={tn.role !== "driver"} serverNow={nowMs} demo={tn.demo} vehicleId={v.id} vehicleName={v.name} hello={t(loc, "drv.hi", { name: driverName.split(" ")[0] })} labels={labels} lastFill={lastFill} loc={loc} initial={shift && !shift.end ? { start: shift.start, priv: !!shift.privateSince } : null} demoKm={liveKm} today={tn.demo ? { km: liveKm ?? 0, hours: demoWorkMs(shift, nowMs) / 3600000 } : todayReal} switchTo={tn.role === "driver" && !tn.demo ? vehicles.filter((x) => x.id !== v.id).map((x) => ({ id: x.id, name: x.name })) : undefined} />

        <section className="section" id="docs">
          <div className="eyebrow">{t(loc, "pw.myDocs")}</div>
          <div className="list" style={{ marginTop: 12 }}>
            {myDocs.length ? myDocs.map((d) => (
              <div key={d.id} className="it" style={{ cursor: "default" }}>
                <div><div className="t">{t(loc, `doc.${d.type}` as MsgKey)} · {d.scope === "vehicle" ? v.name : d.ownerId}</div><div className="m">{t(loc, "docs.expires")} {fmtDate(loc, d.expires!, true)}</div></div>
                <span className={`badge ${STATUS_CLASS[d.st.status]}`}>{d.st.status === "expired" ? t(loc, "dc.expired", { n: -d.st.days }) : d.st.status === "valid" ? t(loc, "docs.ok") : t(loc, "docs.days", { n: plural(loc, d.st.days, "u.day") })}</span>
              </div>
            )) : <p className="sub">{t(loc, "dc.none")}</p>}
          </div>
        </section>
      </main>
    </Gate>
  );
}
