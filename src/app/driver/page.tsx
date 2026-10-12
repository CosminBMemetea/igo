import { demoShift } from "@/lib/demo-shift";
import { store } from "@/lib/store";
import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { fmtDate, t, type MsgKey, plural } from "@/lib/i18n";
import { Gate } from "@/components/Gate";
import { DriverApp } from "@/components/DriverApp";
import { TripPaperwork } from "@/components/TripPaperwork";
import { paperworkFor } from "@/lib/paperwork";
import { docStatus, STATUS_CLASS } from "@/lib/docs";
import { todayFor } from "@/lib/today";

export const dynamic = "force-dynamic";
const KEYS: MsgKey[] = ["drv.vehicle", "drv.kmToday", "drv.hoursToday", "drv.start", "drv.stop", "drv.onShift", "drv.offShift", "drv.check", "drv.checkNeeded", "chk.tyres", "chk.fluids", "chk.docs", "chk.damage", "drv.fill", "drv.photo", "drv.photoHint", "drv.reading", "drv.read", "drv.readManual", "drv.litres", "drv.odo", "drv.amount", "drv.station", "drv.send", "drv.sent", "drv.lastFill", "drv.consent", "drv.gpsOff", "drv.invalid", "priv.on", "priv.break", "priv.offShift", "priv.tracking", "priv.trackingHint", "priv.toggle", "priv.resume"];
const PW: MsgKey[] = ["pw.today", "pw.loaded", "pw.unloaded", "pw.tap", "pw.wait", "pw.waitStop", "pw.waitHint", "pw.cmr", "pw.pod", "pw.photo", "pw.none", "pw.geo", "pw.geoOff", "pw.err", "pw.tooBig", "pw.uploaded", "pw.demo", "pw.ev.loaded", "pw.ev.unloaded", "pw.ev.wait_start", "pw.ev.wait_end"];
export default async function Driver({ searchParams }: { searchParams: { v?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const tn = await tenant(), r = tn.repo;
  const vehicles = await r.vehicles();
  if (!vehicles.length) return <main><EmptyState kind={tn.role === "driver" ? "driver" : "driverOwner"} loc={loc} canSetup={tn.role !== "driver"} /></main>;
  const me = tn.uid && tn.firm ? (await store().users(tn.firm.id)).find((u) => u.id === tn.uid) : null;
  const v = vehicles.find((x) => x.id === searchParams.v) ?? vehicles.find((x) => x.id === me?.truckId) ?? vehicles[0];
  const fd = await r.fleetData();
  const last = [...(await r.driverFills(v.id))].pop();
  const lastCard = fd.fills.filter((f) => f.truckId === v.id).pop();
  const lastFill = last ? `${last.litres} L · ${last.station || "—"}` : lastCard ? `${lastCard.litres} L · ${lastCard.station}` : "—";
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(loc, k)]));
  const today = todayFor(tn.demo);
  const trips = (await r.trips()).filter((x) => x.vehicleId === v.id).sort((a, b) => Number(b.active) - Number(a.active) || b.date.localeCompare(a.date));
  const trip = trips.find((x) => x.date === today) ?? trips[0];
  const pw = trip ? await paperworkFor(tn, trip.id) : null;
  const shift = (tn.demo ? demoShift(v.id) : null) ?? await r.shift(v.id);
  const driverName = v.driver || me?.name || "";
  const myDocs = (await r.docs()).filter((d) => d.expires && ((d.scope === "vehicle" && d.ownerId === v.id) || (d.scope === "driver" && (tn.demo ? d.ownerId === driverName : d.userId === tn.uid))))
    .map((d) => ({ ...d, st: docStatus(d.expires!, today) })).sort((a, b) => a.st.days - b.st.days);
  return (
    <Gate feature="driverApp" prefs={prefs}>
      <main>{!tn.demo && vehicles.length > 1 ? <div className="seg" style={{ marginBottom: 8, flexWrap: "wrap", width: "auto" }}>{vehicles.map((x) => <a key={x.id} href={`/driver?v=${x.id}`} className={x.id === v.id ? "on" : ""}>{x.name}</a>)}</div> : null}
        <DriverApp vehicleId={v.id} vehicleName={v.name} hello={t(loc, "drv.hi", { name: driverName.split(" ")[0] })} labels={labels} lastFill={lastFill} loc={loc} initial={shift && !shift.end ? { start: shift.start, priv: !!shift.privateSince } : null} demoKm={tn.demo && trip ? { kmh: 64, cap: trip.km } : null} />
        {trip && pw ? <TripPaperwork loc={loc} tripId={trip.id} title={`${trip.title} · ${fmtDate(loc, trip.date, true)}`} demo={tn.demo} onShift={!!shift && !shift.end && !shift.privateSince} initial={{ loadedAt: pw.loadedAt, unloadedAt: pw.unloadedAt, waitMin: pw.waiting ? pw.waitMin - Math.round((Date.now() - Date.parse(pw.waitSince!)) / 60000) : pw.waitMin, waitSince: pw.waitSince, files: pw.files }} L={Object.fromEntries(PW.map((k) => [k, t(loc, k)]))} /> : <p className="sub" style={{ marginTop: 32 }}>{t(loc, "pw.noTrip")}</p>}
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
