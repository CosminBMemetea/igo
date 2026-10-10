import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { repo } from "@/lib/repo";
import { load } from "@/lib/data";
import { fmtDate, fmtMoney, fmtNum, t } from "@/lib/i18n";
import { haversineKm } from "@/lib/fleet/data";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";
export default async function Receipts() {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  const fd = await repo().fleetData();
  const driver = await repo().driverFills();
  const fills = fd.fills.filter((f) => f.time >= "2026-10-01").sort((a, b) => b.time.localeCompare(a.time));
  const fuel = fills.reduce((s, f) => s + f.priceLei, 0);
  const tolls = d.views.filter((v) => !v.active && v.date >= "2026-10-01").reduce((s, v) => s + v.tolls, 0);
  const cats: [string, number][] = [[t(loc, "cat.fuel"), fuel], [t(loc, "cat.tolls"), tolls], [t(loc, "cat.service"), 11900], [t(loc, "cat.adblue"), Math.round(fuel * 0.04)], [t(loc, "cat.parking"), 1260]];
  const max = Math.max(...cats.map((c) => c[1]));
  return (
    <Gate feature="receipts" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "rc.title")}</div>
        <h1 className="h1 fade">{t(loc, "rc.sub")}</h1>
        <section className="section">
          <div className="head"><h2>{t(loc, "rc.byCat")}</h2></div>
          <div className="wf">
            {cats.map(([n, v]) => <div className="r" key={n}><span>{n}</span><div className="bar"><i style={{ left: 0, width: `${(v / max) * 100}%`, background: n === cats[0][0] ? "var(--fg)" : "var(--fg2)" }} /></div><span className="v">{fmtMoney(loc, v)}</span></div>)}
          </div>
        </section>
        <section className="section">
          {[...driver.map((f) => ({ id: f.id, time: f.time, station: f.station || "—", litres: f.litres, amount: f.amount ?? 0, truckId: f.vehicleId, ok: true, ai: f.aiRead })), ...fills.slice(0, 16).map((f) => ({ id: f.id, time: f.time, station: f.station, litres: f.litres, amount: f.priceLei, truckId: f.truckId, ok: haversineKm(f.gpsAt, f.stationAt) <= 5, ai: false }))].map((f) => {
            const v = d.vehicles.find((x) => x.id === f.truckId);
            return (
              <div key={f.id} className="row r4" style={{ cursor: "default" }}>
                <div><div className="t">{f.station}</div><div className="m">{fmtDate(loc, f.time)} · {v?.name}</div></div>
                <div className="v">{fmtNum(loc, f.litres)} L</div>
                <div className="v">{fmtMoney(loc, f.amount)}</div>
                <div style={{ textAlign: "right" }}>{f.ok ? <span className="badge ok">{t(loc, "rc.matched")} {v?.name}</span> : <Link href="/alerts" className="badge bad">{t(loc, "rule.card-fara-camion")}</Link>}</div>
              </div>
            );
          })}
        </section>
      </main>
    </Gate>
  );
}
