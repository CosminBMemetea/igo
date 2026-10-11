import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { vehicleSummary } from "@/lib/query";
import { fmtMoney, fmtNum, t } from "@/lib/i18n";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import { mapLabels } from "@/lib/labels";
import { CountUp } from "@/components/CountUp";
import FleetMap from "@/components/FleetMap";
import { Gate } from "@/components/Gate";
import { VehicleArt } from "@/components/VehicleArt";
import { TripRows } from "../../TripRows";

export const dynamic = "force-dynamic";
export default async function VehiclePage({ params }: { params: { id: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  const v = d.vehicles.find((x) => x.id === params.id);
  if (!v) notFound();
  const s = vehicleSummary(v, d.views);
  const agri = v.kind === "agri";
  const unit = agri ? t(loc, "veh.lha") : t(loc, "veh.l100");
  const myParcels = d.parcels.filter((p) => s.trips.some((x) => x.parcelId === p.id));
  const liveV = d.live().find((x) => x.id === v.id);
  const body = (
    <main>
      <section className="vehicle">
        <div className="fade">
          <div className="eyebrow">{t(loc, `kind.${v.kind}`)} · {v.model}</div>
          <h1 className="h1">{v.name}</h1>
          <p className="sub">{v.driver}{agri ? ` · ${t(loc, "veh.season")}` : ""}</p>
          <div style={{ marginTop: 44 }}>
            <div className="eyebrow">{t(loc, "home.savings")}</div>
            <div className="big"><CountUp value={s.savings.pct * 100} d={1} loc={loc} /><small>%</small></div>
            <p className="sub">{fmtNum(loc, s.actualRate, 1)} {unit} · {t(loc, "veh.savings", { base: fmtNum(loc, v.baselineRate, 1), unit })}</p>
          </div>
        </div>
        <VehicleArt kind={v.kind} />
      </section>
      <section className="cards section">
        {agri ? (
          <>
            <div className="card fade"><div className="k">{t(loc, "veh.lph")}</div><div className="n">{fmtNum(loc, s.hours ? s.savings.actualLitres / s.hours : 0, 1)}</div><div className="d">{t(loc, "veh.hours")}: {fmtNum(loc, v.engineHours ?? 0)} h · {fmtNum(loc, s.hours, 1)} h {t(loc, "veh.season").toLowerCase()}</div></div>
            <div className="card fade d1"><div className="k">{t(loc, "veh.ha")}</div><div className="n">{fmtNum(loc, s.ha)}</div><div className="d">{fmtNum(loc, s.actualRate, 1)} {unit}</div></div>
          </>
        ) : (
          <>
            <div className="card fade"><div className="k">{t(loc, "veh.l100")}</div><div className="n">{fmtNum(loc, s.actualRate, 1)}</div><div className="d">{t(loc, "veh.savings", { base: fmtNum(loc, v.baselineRate, 1), unit })}</div></div>
            <div className="card fade d1"><div className="k">{t(loc, "veh.km")}</div><div className="n">{fmtNum(loc, s.km)}</div><div className="d">{s.n} {t(loc, "veh.trips").toLowerCase()}</div></div>
          </>
        )}
        <div className="card fade d2"><div className="k">{t(loc, "veh.saved")}</div><div className="n pos">{fmtMoney(loc, s.savings.savedLei)}</div><div className="d">({fmtNum(loc, v.baselineRate, 1)} − {fmtNum(loc, s.actualRate, 1)}) × {fmtNum(loc, s.units)} {agri ? "ha" : "km"}{v.per100 ? " / 100" : ""} × {fmtNum(loc, 7.3, 2)}</div></div>
      </section>
      {liveV ? <Link href={`/live?v=${v.id}`} className="mapstrip" style={{ display: "block" }}>
        <FleetMap mode="strip" vehicles={[liveV]} zones={d.zones} parcels={agri ? myParcels : []} theme={prefs.theme} loc={loc} labels={mapLabels(loc)} now={DEMO_NOW_MIN} />
      </Link> : null}
      <section className="section">
        <div className="head"><h2>{t(loc, agri ? "veh.jobs" : "veh.trips")}</h2><span className="link">{t(loc, "veh.profit")}: {fmtMoney(loc, s.profit)}</span></div>
        {agri ? <p className="sub" style={{ marginBottom: 12 }}>{t(loc, "veh.parcels")}: {myParcels.map((p) => `${p.name} (${p.ha} ha, ${t(loc, `crop.${p.crop}`)})`).join(" · ")}</p> : null}
        <TripRows rows={s.trips} loc={loc} />
      </section>
    </main>
  );
  return agri ? <Gate feature="agri" prefs={prefs}>{body}</Gate> : body;
}
