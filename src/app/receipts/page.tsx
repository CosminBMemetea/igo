import { store } from "@/lib/store";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { load } from "@/lib/data";
import { demoReceipts, monthSummary } from "@/lib/query";
import { fmtDate, fmtMoney, fmtNum, t, tri } from "@/lib/i18n";
import { ActionForm } from "@/components/ActionForm";
import { Gate } from "@/components/Gate";
import { leiOf, isRon } from "@/lib/fuel/lei";
import { demoFills } from "@/lib/demo-shift";
import { ReceiptThumb } from "@/components/ReceiptThumb";

export const dynamic = "force-dynamic";
export default async function Receipts() {
  const prefs = (await getPrefs()), { loc } = prefs;
  const d = await load();
  if (!d.demo) {
    const tx = d.tn.firm ? await store().fuel(d.tn.firm.id, { limit: 80 }) : [];
    if (!tx.length) return <main><EmptyState kind="receipts" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
    const canEdit = d.tn.role === "owner" || d.tn.role === "admin", tr = (x: string) => tri(loc, x);
    const lei = tx.reduce((a, x) => a + (leiOf(x) ?? 0), 0), L = tx.reduce((a, x) => a + x.litres, 0);
    return (
      <Gate feature="receipts" prefs={prefs}>
        <main>
          <div className="eyebrow fade">{t(loc, "rc.title")}</div>
          <h1 className="h1 fade">{fmtMoney(loc, lei)}</h1>
          <p className="sub fade d1">{t(loc, tx.length === 1 ? "rc.firmSub1" : "rc.firmSub", { n: tx.length, litres: fmtNum(loc, L) })}</p>
          <section className="section"><div className="receipt-list">
            {tx.map((x) => {
              const v = d.vehicles.find((y) => y.id === x.truckId);
              return (
                <div key={x.id} className="row r4 rcrow" style={{ cursor: "default" }}>
                  <div className="rcmain">{x.photoName?.startsWith("file:") ? <ReceiptThumb id={x.id} has url={`/api/files/${x.photoName.slice(5)}`} label={t(loc, "drv.photo")} /> : null}<div><div className="t">{x.station || "—"}</div><div className="m">{fmtDate(loc, x.at)} · {v?.name ?? x.card ?? "—"}{x.plate && x.source === "driver" && v && x.plate.replace(/[^A-Z0-9]/gi, "").toUpperCase() !== v.name.replace(/[^A-Z0-9]/gi, "").toUpperCase() ? <b className="rc-plate"> · ⚠ {x.plate}</b> : null}</div></div></div>
                  <div className="v">{fmtNum(loc, x.litres, 1)} L</div>
                  <div className="v">{leiOf(x) != null ? fmtMoney(loc, leiOf(x)!) : "—"}{x.amount != null && !isRon(x.currency) ? <small className="fxo" title={x.fxRate ? t(loc, "rc.fx", { rate: fmtNum(loc, x.fxRate, 4), cur: x.currency ?? "", date: fmtDate(loc, x.fxDate ?? "") }) : t(loc, "rc.fxNo")}>{fmtNum(loc, x.amount, 2)} {x.currency}{x.fxRate ? ` · ${fmtNum(loc, x.fxRate, 4)}` : " · ?"}</small> : null}</div>
                  <div style={{ textAlign: "right" }}>{v ? <span className={`badge ${x.source === "driver" ? "acc" : "ok"}`}>{x.source === "driver" ? t(loc, "rc.fromDriver") : t(loc, "rc.fromCard")}</span> : <Link href="/import" className="badge warn">{t(loc, "imp.unknown")}</Link>}</div>
                  {canEdit && x.source === "driver" ? <details className="rcedit"><summary className="btn sec sm">{tr("Editează / șterge|Edit / delete|Edytuj / usuń")}</summary>
                    <ActionForm action="/api/receipts/manage" returnTo="/receipts" loc={loc}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="action" value="save" />
                      <div className="rcgrid"><label className="lf"><span>{tr("Litri|Litres|Litry")}</span><input name="litres" inputMode="decimal" required defaultValue={x.litres} /></label><label className="lf"><span>{tr("Sumă|Amount|Kwota")}{x.currency ? ` (${x.currency})` : ""}</span><input name="amount" inputMode="decimal" defaultValue={x.amount ?? ""} /></label><label className="lf"><span>{tr("Kilometraj|Odometer|Przebieg")}</span><input name="odometer" inputMode="numeric" defaultValue={x.odometer ?? ""} /></label><label className="lf"><span>{tr("Stație|Station|Stacja")}</span><input name="station" maxLength={80} defaultValue={x.station} /></label></div>
                      <button className="btn pri sm" type="submit">{t(loc, "stg.save")}</button></ActionForm>
                    <details className="rcdel"><summary className="btn sec sm danger">{tr("Șterge bonul|Delete receipt|Usuń paragon")}</summary><ActionForm action="/api/receipts/manage" returnTo="/receipts" loc={loc}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="action" value="delete" /><p>{tr("Bonul și poza lui se șterg definitiv. Alertele de carburant se recalculează fără el.|The receipt and its photo are deleted permanently. Fuel alerts are recalculated without it.|Paragon i jego zdjęcie zostaną trwale usunięte. Alerty paliwowe zostaną przeliczone bez niego.")}</p><button className="btn pri sm danger" type="submit">{tr("Da, șterge|Yes, delete|Tak, usuń")}</button></ActionForm></details>
                  </details> : null}
                </div>
              );
            })}
          </div></section>
        </main>
      </Gate>
    );
  }
  // demo: bonurile trimise de șofer în sesiunea demo a acestui browser (cookie), primele în listă
  const driver = [...(await demoFills()).map((x) => ({ id: x.id, time: x.t, station: x.s, litres: x.l, amount: x.a, vehicleId: x.v, aiRead: false, cur: x.c, orig: x.r, photo: !!x.p })).reverse(), ...(await (await tenant()).repo.driverFills()).map((x) => ({ ...x, cur: null, orig: null, photo: !!x.photo, file: x.photo?.fileId ?? null }))];
  // aceeași sursă ca Acasă/Curse/Clienți: cursele încheiate
  const m = monthSummary(d.views);
  const fills = demoReceipts(d.views).sort((a, b) => b.time.localeCompare(a.time)).map((f) => ({ ...f, priceLei: f.amount }));
  const fuel = m.fuelLei + driver.reduce((a, x) => a + (x.amount ?? 0), 0), tolls = m.tolls;
  const cats: [string, number][] = [[t(loc, "cat.fuel"), fuel], [t(loc, "cat.tolls"), tolls], [t(loc, "cat.service"), 11900], [t(loc, "cat.adblue"), Math.round(m.fuelLei * 0.04)], [t(loc, "cat.parking"), 1260]];
  const max = Math.max(...cats.map((c) => c[1]));
  return (
    <Gate feature="receipts" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "rc.title")}</div>
        <h1 className="h1 fade">{t(loc, "rc.sub")}</h1>
        <p className="sub fade d1">{t(loc, fills.length + driver.length === 1 ? "rc.firmSub1" : "rc.firmSub", { n: fills.length + driver.length, litres: fmtNum(loc, m.litres + driver.reduce((a, x) => a + x.litres, 0)) })} · {fmtMoney(loc, fuel)}</p>
        <section className="section">
          <div className="head"><h2>{t(loc, "rc.byCat")}</h2></div>
          <div className="wf">
            {cats.map(([n, v]) => <div className="r" key={n}><span>{n}</span><span className="v">{fmtMoney(loc, v)}</span><div className="bar"><i style={{ left: 0, width: `${(v / max) * 100}%`, background: n === cats[0][0] ? "var(--fg)" : "var(--fg2)" }} /></div></div>)}
          </div>
        </section>
        <section className="section"><div className="receipt-list">
          {[...driver.map((f) => ({ id: f.id, time: f.time, station: f.station || "—", litres: f.litres, amount: f.amount ?? 0, truckId: f.vehicleId, ok: true, ai: f.aiRead, drv: true, photo: f.photo, file: "file" in f ? f.file : null, orig: f.cur && f.orig ? { amount: f.orig, cur: f.cur } : null })), ...fills.map((f) => ({ id: f.id, time: f.time, station: f.station, litres: f.litres, amount: f.priceLei, truckId: f.truckId, ok: true, ai: false, orig: "currency" in f && f.currency && f.origAmount ? { amount: f.origAmount, cur: f.currency } : null }))].map((f) => {
            const v = d.vehicles.find((x) => x.id === f.truckId);
            return (
              <div key={f.id} className="row r4 rcrow" style={{ cursor: "default" }}>
                <div className="rcmain">{"photo" in f ? <ReceiptThumb id={f.id} has={!!f.photo} url={(f as { file?: string | null }).file ? `/api/files/${(f as { file?: string | null }).file}` : null} label={t(loc, "drv.photo")} /> : null}<div><div className="t">{f.station}</div><div className="m">{fmtDate(loc, f.time)} · {v?.name}</div></div></div>
                <div className="v">{fmtNum(loc, f.litres)} L</div>
                <div className="v">{f.amount ? fmtMoney(loc, f.amount) : "—"}{"orig" in f && f.orig ? <small className="fxo">{fmtNum(loc, (f.orig as { amount: number }).amount, 2)} {(f.orig as { cur: string }).cur}</small> : null}</div>
                <div style={{ textAlign: "right" }}>{"drv" in f && f.drv ? <span className="badge acc">{t(loc, "rc.fromDriver")}</span> : f.ok ? <span className="badge ok">{t(loc, "rc.matched")} {v?.name}</span> : <Link href="/alerts" className="badge bad">{t(loc, "rule.card-fara-camion")}</Link>}</div>
              </div>
            );
          })}
        </div></section>
      </main>
    </Gate>
  );
}
