import { store } from "@/lib/store";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { load } from "@/lib/data";
import { demoReceipts, monthSummary } from "@/lib/query";
import { fmtDate, fmtMoney, fmtNum, t } from "@/lib/i18n";
import { Gate } from "@/components/Gate";
import { leiOf, isRon } from "@/lib/fuel/lei";
import { demoFills } from "@/lib/demo-shift";

export const dynamic = "force-dynamic";
export default async function Receipts() {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  if (!d.demo) {
    const tx = d.tn.firm ? await store().fuel(d.tn.firm.id, { limit: 80 }) : [];
    if (!tx.length) return <main><EmptyState kind="receipts" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
    const lei = tx.reduce((a, x) => a + (leiOf(x) ?? 0), 0), L = tx.reduce((a, x) => a + x.litres, 0);
    return (
      <Gate feature="receipts" prefs={prefs}>
        <main>
          <div className="eyebrow fade">{t(loc, "rc.title")}</div>
          <h1 className="h1 fade">{fmtMoney(loc, lei)}</h1>
          <p className="sub fade d1">{t(loc, "rc.firmSub", { n: tx.length, litres: fmtNum(loc, L) })}</p>
          <section className="section">
            {tx.map((x) => {
              const v = d.vehicles.find((y) => y.id === x.truckId);
              return (
                <div key={x.id} className="row r4 rcrow" style={{ cursor: "default" }}>
                  <div><div className="t">{x.station || "—"}</div><div className="m">{fmtDate(loc, x.at)} · {v?.name ?? x.card ?? "—"}</div></div>
                  <div className="v">{fmtNum(loc, x.litres, 1)} L</div>
                  <div className="v">{leiOf(x) != null ? fmtMoney(loc, leiOf(x)!) : "—"}{x.amount != null && !isRon(x.currency) ? <small className="fxo" title={x.fxRate ? t(loc, "rc.fx", { rate: fmtNum(loc, x.fxRate, 4), cur: x.currency ?? "", date: fmtDate(loc, x.fxDate ?? "") }) : t(loc, "rc.fxNo")}>{fmtNum(loc, x.amount, 2)} {x.currency}{x.fxRate ? ` · ${fmtNum(loc, x.fxRate, 4)}` : " · ?"}</small> : null}</div>
                  <div style={{ textAlign: "right" }}>{v ? <span className={`badge ${x.source === "driver" ? "acc" : "ok"}`}>{x.source === "driver" ? t(loc, "rc.fromDriver") : t(loc, "rc.fromCard")}</span> : <Link href="/import" className="badge warn">{t(loc, "imp.unknown")}</Link>}</div>
                </div>
              );
            })}
          </section>
        </main>
      </Gate>
    );
  }
  // demo: bonurile trimise de șofer în sesiunea demo a acestui browser (cookie), primele în listă
  const driver = [...demoFills().map((x) => ({ id: x.id, time: x.t, station: x.s, litres: x.l, amount: x.a, vehicleId: x.v, aiRead: false, cur: x.c, orig: x.r })).reverse(), ...(await (await tenant()).repo.driverFills()).map((x) => ({ ...x, cur: null, orig: null }))];
  // aceeași sursă ca Acasă/Curse/Clienți: cursele încheiate
  const m = monthSummary(d.views);
  const fills = demoReceipts(d.views).sort((a, b) => b.time.localeCompare(a.time)).map((f) => ({ ...f, priceLei: f.amount }));
  const fuel = m.fuelLei, tolls = m.tolls;
  const cats: [string, number][] = [[t(loc, "cat.fuel"), fuel], [t(loc, "cat.tolls"), tolls], [t(loc, "cat.service"), 11900], [t(loc, "cat.adblue"), Math.round(fuel * 0.04)], [t(loc, "cat.parking"), 1260]];
  const max = Math.max(...cats.map((c) => c[1]));
  return (
    <Gate feature="receipts" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "rc.title")}</div>
        <h1 className="h1 fade">{t(loc, "rc.sub")}</h1>
        <p className="sub fade d1">{t(loc, "rc.firmSub", { n: fills.length + driver.length, litres: fmtNum(loc, m.litres + driver.reduce((a, x) => a + x.litres, 0)) })} · {fmtMoney(loc, m.fuelLei)}</p>
        <section className="section">
          <div className="head"><h2>{t(loc, "rc.byCat")}</h2></div>
          <div className="wf">
            {cats.map(([n, v]) => <div className="r" key={n}><span>{n}</span><div className="bar"><i style={{ left: 0, width: `${(v / max) * 100}%`, background: n === cats[0][0] ? "var(--fg)" : "var(--fg2)" }} /></div><span className="v">{fmtMoney(loc, v)}</span></div>)}
          </div>
        </section>
        <section className="section">
          {[...driver.map((f) => ({ id: f.id, time: f.time, station: f.station || "—", litres: f.litres, amount: f.amount ?? 0, truckId: f.vehicleId, ok: true, ai: f.aiRead, drv: true, orig: f.cur && f.orig ? { amount: f.orig, cur: f.cur } : null })), ...fills.map((f) => ({ id: f.id, time: f.time, station: f.station, litres: f.litres, amount: f.priceLei, truckId: f.truckId, ok: true, ai: false, orig: "currency" in f && f.currency && f.origAmount ? { amount: f.origAmount, cur: f.currency } : null }))].map((f) => {
            const v = d.vehicles.find((x) => x.id === f.truckId);
            return (
              <div key={f.id} className="row r4 rcrow" style={{ cursor: "default" }}>
                <div><div className="t">{f.station}</div><div className="m">{fmtDate(loc, f.time)} · {v?.name}</div></div>
                <div className="v">{fmtNum(loc, f.litres)} L</div>
                <div className="v">{f.amount ? fmtMoney(loc, f.amount) : "—"}{"orig" in f && f.orig ? <small className="fxo">{fmtNum(loc, (f.orig as { amount: number }).amount, 2)} {(f.orig as { cur: string }).cur}</small> : null}</div>
                <div style={{ textAlign: "right" }}>{"drv" in f && f.drv ? <span className="badge acc">{t(loc, "rc.fromDriver")}</span> : f.ok ? <span className="badge ok">{t(loc, "rc.matched")} {v?.name}</span> : <Link href="/alerts" className="badge bad">{t(loc, "rule.card-fara-camion")}</Link>}</div>
              </div>
            );
          })}
        </section>
      </main>
    </Gate>
  );
}
