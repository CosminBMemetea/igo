import { tripStage, STAGE_LABELS } from "@/lib/trip-stage";
import { ActionForm } from "@/components/ActionForm";
import { tri } from "@/lib/i18n";
import { localNow } from "@/lib/validate";
import { store } from "@/lib/store";
import { NewTrip } from "@/components/NewTrip";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { notFound } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { fmtDate, fmtMoney, fmtNum, fmtPct, t } from "@/lib/i18n";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import { mapLabels } from "@/lib/labels";
import { CountUp } from "@/components/CountUp";
import FleetMap from "@/components/FleetMap";
import { fullPath } from "@/lib/query";
import { paperworkFor } from "@/lib/paperwork";
import { EL, ef } from "@/lib/econ-i18n";

export const dynamic = "force-dynamic";
export default async function TripDetail(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const prefs = (await getPrefs()), { loc } = prefs;
  const d = await load();
  const r = [...d.views, ...d.cancelledViews].find((x) => x.id === params.id);
  // „Duplică cursa”: aceeași rută / șofer / client, pentru mâine (firmă reală)
  const raw = !d.demo && d.tn.firm && (d.tn.role === "owner" || d.tn.role === "admin") ? (await store().trips(d.tn.firm.id)).find((x) => x.id === params.id) : null;
  const dupNt = raw ? <div className="tdup"><NewTrip dup loc={(await getPrefs()).loc} today={localNow().slice(0, 10)} prefill={{ from: raw.title.split(" → ")[0], to: raw.title.split(" → ")[1] ?? "", driverId: raw.driverId ?? null, truckId: raw.truckId, client: raw.client, tonnes: raw.tonnes ?? null, km: raw.km, revenue: raw.revenue ?? null }} drivers={(await store().users(d.tn.firm!.id)).filter((u) => u.role === "driver" && !u.disabledAt).map((u) => ({ id: u.id, name: u.name || u.phone || "—", truckId: u.truckId ?? null }))} trucks={d.vehicles.map((v) => ({ id: v.id, plate: v.name }))} />{raw.planned && !raw.loadedAt && !raw.cancelledAt ? <NewTrip editId={raw.id} loc={(await getPrefs()).loc} today={localNow().slice(0, 10)} prefill={{ date: raw.date, from: raw.title.split(" → ")[0], to: raw.title.split(" → ")[1] ?? "", driverId: raw.driverId ?? null, truckId: raw.truckId, client: raw.client, tonnes: raw.tonnes ?? null, km: raw.km, revenue: raw.revenue ?? null }} drivers={(await store().users(d.tn.firm!.id)).filter((u) => u.role === "driver" && !u.disabledAt).map((u) => ({ id: u.id, name: u.name || u.phone || "—", truckId: u.truckId ?? null }))} trucks={d.vehicles.map((v) => ({ id: v.id, plate: v.name }))} /> : null}</div> : null;
  if (!r) notFound();
  const agri = r.vehicle.kind === "agri";
  const unit = r.vehicle.per100 ? "L/100km" : "L/ha";
  const p = r.p, max = Math.max(1, p.revenue, p.costs);
  const segs: [string, number, string][] = [
    [t(loc, "trip.fuel"), p.fuel, `${fmtNum(loc, r.litres)} L × ${fmtMoney(loc, r.fuelPrice, 2)}`],
    [t(loc, "trip.tolls"), p.tolls, agri ? "—" : ""],
    [t(loc, agri ? "trip.operator" : "trip.driver"), p.driver, agri ? `${fmtNum(loc, r.hours, 1)} h` : ""],
    [t(loc, "trip.other"), p.other, agri ? `${r.ha} ha` : `${fmtNum(loc, r.km)} km`],
  ];
  const E = r.e, L = EL[loc];
  if (E) segs.splice(0, segs.length,
    [L.fuel, E.fuel, `${fmtNum(loc, r.litres)} L × ${fmtMoney(loc, r.fuelPrice, 2)}`],
    [L.tolls, E.tolls, ""],
    [L.driver, E.driver, ""],
    [L.adblue, E.adblue, `${fmtNum(loc, r.km)} km`],
    [L.tyres, E.tyres, ""],
    [L.service, E.service, ""],
    [L.wearLoad, E.loadWear, E.tonnes ? `${fmtNum(loc, E.tonnes, 1)} t × ${fmtNum(loc, r.km - E.emptyKm)} km` : "—"],
    [t(loc, "trip.other"), r.other, ""],
    [L.fixedShare, E.fixed, `${fmtMoney(loc, E.fixedPerKm, 2)} ${L.perKm}`],
  );
  const canEdit = d.tn.role !== "driver" && (d.demo || d.tn.role === "owner" || d.tn.role === "admin");
  let acc = 0;
  const client = d.clients.find((c) => c.id === r.clientId)!;
  const liveV = (await d.live()).find((x) => x.id === r.vehicleId);
  const pw = agri ? null : await paperworkFor(d.tn, r.id);
  const canPod = !d.demo && (d.tn.role === "owner" || d.tn.role === "admin");
  const hm = (iso: string | null) => (iso ? new Intl.DateTimeFormat(loc === "ro" ? "ro-RO" : loc === "pl" ? "pl-PL" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(new Date(iso)) : "—");
  return (
    <main>
      <div className="eyebrow fade">{t(loc, agri ? "job.detail" : "trip.detail")}{!d.demo || !agri ? ` · ${tri(loc, STAGE_LABELS[tripStage(r)])}` : r.active ? ` · ${t(loc, r.planned ? "trip.planned" : "trip.active")}` : ""}</div>
      <div className="vhead fade"><h1 className="h1">{agri ? `${t(loc, `type.${r.type}`)} · ${r.title}` : r.title}</h1></div>
      <div className="trip-actions">{!agri && !r.cancelledAt && (!r.planned || r.loadedAt || r.deliveredAt) ? <Link className="btn sec" href={`/replay?trip=${r.id}`}><Icon name="trips" size={18} /><span>{t(loc, "rp.cta")}</span></Link> : null}{dupNt}</div>
      {raw?.cancelledAt ? <section className="sheet"><h2>{tri(loc, "Cursă anulată|Trip cancelled|Kurs anulowany")}</h2><p>{raw.cancelReason}</p><p className="hint">{tri(loc, "Păstrată în istoric. Nu intră în venitul și profitul realizat.|Kept in history. Excluded from realized revenue and profit.|Zachowany w historii. Wyłączony z przychodu i zysku.")}</p></section> : null}
      {raw?.planned && !raw.loadedAt && !raw.cancelledAt ? <details className="sheet"><summary className="btn sec danger">{tri(loc, "Anulează cursa|Cancel trip|Anuluj kurs")}</summary><ActionForm action="/api/trips/cancel" loc={loc}><input type="hidden" name="id" value={raw.id} /><p>{tri(loc, "Anularea este disponibilă înainte de încărcare. Cursa și motivul rămân în istoric.|Cancellation is available before loading. The trip and reason remain in history.|Anulowanie jest możliwe przed załadunkiem. Kurs i powód pozostają w historii.")}</p><label className="lf"><span>{tri(loc, "Motivul anulării|Cancellation reason|Powód anulowania")}</span><textarea name="reason" required minLength={3} maxLength={500} /></label><button className="btn sec danger">{tri(loc, "Confirm anularea|Confirm cancellation|Potwierdź anulowanie")}</button></ActionForm></details> : null}
      <p className="sub fade d1">{[r.vehicle.name, r.driverName ?? r.vehicle.driver, fmtDate(loc, r.date, true), agri ? `${r.ha} ha · ${fmtNum(loc, r.hours, 1)} h` : `${fmtNum(loc, r.km)} km`, client.name, (r.tariffNote && loc !== "en" ? r.tariffNote.replace(/(\d)\.(\d)/g, "$1,$2") : r.tariffNote).replace("lei", t(loc, "cur"))].filter(Boolean).join(" · ")}</p>
      {!r.cancelledAt ? <><section className="hero thero" style={{ marginTop: 56 }}>
        <div className="fade d1"><div className="eyebrow">{E ? L.realProfit : t(loc, "col.profit")}</div><div className={`big ${p.profit < 0 ? "neg" : "pos"}`}><CountUp value={Math.round(p.profit)} loc={loc} /><small>{t(loc, "cur")}</small></div><p className="sub">{fmtPct(loc, p.margin)} {t(loc, "col.margin")}</p></div>
        <div className="fade d2"><div className="eyebrow">{t(loc, "home.savings")}</div><div className="big"><CountUp value={r.s.pct * 100} d={1} loc={loc} /><small>%</small></div>
          <p className="sub" dangerouslySetInnerHTML={{ __html: t(loc, "trip.vsBase", { actual: fmtNum(loc, r.actualRate, 1), unit, base: fmtNum(loc, r.vehicle.baselineRate, 1), litres: fmtNum(loc, r.s.savedLitres), lei: fmtMoney(loc, r.s.savedLei) }) }} /></div>
      </section>
      <p className="hint fuel-source">{t(loc, d.demo ? "fuel.demo" : r.litresSource === "estimate" ? "fuel.estimate" : "fuel.manual")}</p>
      <p className="hint fuel-source">{t(loc, `fuel.base.${d.demo ? "demo" : r.vehicle.baselineKind ?? "default"}`)}</p>
      <section className="wf section">
        <div className="r"><span>{t(loc, "col.revenue")}</span><span className="v">{fmtMoney(loc, p.revenue)}</span><div className="bar"><i style={{ left: 0, width: `${(p.revenue / max) * 100}%`, background: "var(--fg)" }} /></div></div>
        {segs.map(([name, val, note], i) => {
          const left = acc; acc += val;
          return <div className="r" key={name}><span>{name}{note ? <><br /><small style={{ color: "var(--fg3)" }}>{note}</small></> : null}</span><span className="v">− {fmtMoney(loc, val)}</span><div className="bar"><i style={{ left: `${(left / max) * 100}%`, width: `${(val / max) * 100}%`, background: "var(--fg2)", animationDelay: `${0.1 * (i + 1)}s` }} /></div></div>;
        })}
        <div className="r" style={{ paddingTop: 24 }}><b style={{ fontWeight: 500 }}>{E ? L.realProfit : t(loc, "col.profit")}</b><span className={`v ${p.profit < 0 ? "neg" : "pos"}`} style={{ fontSize: 22 }}>{fmtMoney(loc, p.profit)}</span><div className="bar">{p.profit > 0 ? <i style={{ left: `${(p.costs / max) * 100}%`, width: `${(p.profit / max) * 100}%`, background: "var(--pos)", animationDelay: ".5s" }} /> : <i style={{ left: `${(p.revenue / max) * 100}%`, width: `${(-p.profit / max) * 100}%`, background: "var(--neg)", animationDelay: ".5s" }} />}</div></div>
        <p className="sub" style={{ fontSize: 12 }}>{E ? L.formula : t(loc, "trip.formula")}</p>
      </section>
      </> : null}
      {!r.cancelledAt && !d.demo && (!r.vehicle.costsConfigured || r.litresSource === "estimate") ? <p className="msg warn">{tri(loc, "Profit estimat din datele completate. Costurile necompletate nu sunt incluse; alimentările nu înlocuiesc consumul cursei.|Estimated profit based on entered data. Missing costs are excluded; fuel purchases do not replace trip consumption.|Szacowany zysk na podstawie wpisanych danych. Brakujące koszty nie są uwzględnione; zakupy paliwa nie zastępują zużycia kursu.")}</p> : null}
      {!agri && !r.cancelledAt && !d.demo && p.tolls === 0 ? <p className="msg warn">{tri(loc, "Taxe de drum: 0 lei înregistrat. Verifică taxele aplicabile înainte să te bazezi pe profitul afișat. Aplicația nu calculează și nu achită automat taxele traseului.|Road tolls: 0 recorded. Check applicable tolls before relying on the displayed profit. The app does not automatically calculate or pay route tolls.|Opłaty drogowe: zapisano 0. Sprawdź wymagane opłaty przed oceną zysku. Aplikacja nie oblicza ani nie opłaca ich automatycznie.")}</p> : null}
      {!d.demo && raw?.planned && !!raw.deliveredAt && !raw.cancelledAt && raw.date <= localNow().slice(0, 10) ? <details className="sheet"><summary className="btn pri">{tri(loc, "Finalizează cursa|Complete trip|Zakończ kurs")}</summary><ActionForm action="/api/trips/complete" loc={loc}><input type="hidden" name="id" value={raw.id} /><p>{tri(loc, "Confirmă că transportul a fost efectuat. Cursa va intra în rezultatele lunii sale.|Confirm that transport was completed. The trip will enter results for its month.|Potwierdź wykonanie transportu. Kurs zostanie ujęty w wynikach swojego miesiąca.")}</p><button className="btn pri">{tri(loc, "Confirm finalizarea|Confirm completion|Potwierdź zakończenie")}</button></ActionForm></details> : null}
      {E && !r.cancelledAt ? (
        <section className="section">
          <div className="head"><h2>{L.load}</h2>{E.tonnes === 0 ? <span className="lbadge empty">↩ {L.emptyRet}</span> : null}</div>
          <div className="eload">
            <div className="card"><div className="k">{L.tonnes}</div><div className="n">{E.tonnes === null ? "—" : `${fmtNum(loc, E.tonnes, 1)} t`}</div><div className="d">{ef(L.ofCap, { t: fmtNum(loc, E.tonnes ?? 0, 1), c: fmtNum(loc, E.capacityT, 1) })}</div></div>
            <div className="card"><div className="k">{L.load}</div><div className="n">{E.loadPct === null ? "—" : fmtPct(loc, E.loadPct, 0)}</div><span className="ebar" aria-hidden="true"><i style={{ width: `${Math.min(100, (E.loadPct ?? 0) * 100)}%` }} /></span></div>
            <div className="card"><div className="k">{L.emptyKm}</div><div className={`n${E.emptyKm / Math.max(1, r.km) > 0.2 ? " warn" : ""}`}>{fmtNum(loc, E.emptyKm)} km</div><div className="d">{ef(L.emptyOf, { n: fmtNum(loc, E.emptyKm), k: fmtNum(loc, r.km) })}</div></div>
            <div className="card"><div className="k">{L.wearKm}</div><div className="n">{fmtMoney(loc, (E.tyres + E.service + E.loadWear) / Math.max(1, r.km), 2)}</div><div className="d">{L.wearT}: {E.tonnes ? fmtMoney(loc, (E.tyres + E.service + E.loadWear) / E.tonnes, 0) : "—"}</div></div>
            <div className="card"><div className="k">{L.costT}</div><div className="n">{E.costPerT === null ? "—" : fmtMoney(loc, E.costPerT, 0)}</div><div className="d">{L.costKm}: {fmtMoney(loc, E.costPerKm, 2)}</div></div>
          </div>
          {canEdit ? (
            <ActionForm action="/api/vehicles/econ" loc={loc}>
              <input type="hidden" name="action" value="trip" /><input type="hidden" name="tid" value={r.id} /><input type="hidden" name="vid" value={r.vehicleId} />
              <div className="trip-recalculate">
                <h3>{L.editTrip}</h3>
                <div className="trip-recalculate-fields">
                  <label className="lf"><span>{L.freight} ({t(loc, "cur")})</span><input name="revenue" inputMode="decimal" defaultValue={String(r.revenue)} /></label>
                  <label className="lf"><span>{L.tonnes} (t)</span><input name="tonnes" inputMode="decimal" defaultValue={E.tonnes === null ? "" : String(E.tonnes)} /></label>
                  <button className="btn pri" type="submit">{L.apply}</button>
                </div>
                {d.demo ? <p className="hint">{L.demoNote}</p> : null}
              </div>
            </ActionForm>
          ) : null}
        </section>
      ) : null}
      {r.active && !r.cancelledAt && liveV ? (
        <Link href={`/live?v=${r.vehicleId}`} className="mapstrip" style={{ display: "block" }}>
          <FleetMap mode="strip" vehicles={[r.active ? liveV : { ...liveV, done: [], ahead: fullPath(r.vehicleId, r.title).length ? fullPath(r.vehicleId, r.title) : liveV.done, track: [] }]} zones={d.zones} parcels={d.parcels} theme={prefs.theme} loc={loc} labels={mapLabels(loc)} now={DEMO_NOW_MIN} />
        </Link>
      ) : null}
      {pw ? (
        <section className="section">
          <div className="head"><h2>{t(loc, "pw.title")}</h2><span className={`badge ${pw.podReceived ? "ok" : "warn"}`}>{pw.podReceived ? t(loc, "pw.podOk") : t(loc, "pw.podWait")}</span></div>
          <div className="tpw">
            <div className="card"><div className="k">{t(loc, "pw.loaded")}</div><div className="n" style={{ fontSize: 22 }}>{hm(pw.loadedAt)}</div></div>
            <div className="card"><div className="k">{t(loc, "pw.unloaded")}</div><div className="n" style={{ fontSize: 22 }}>{hm(pw.unloadedAt)}</div></div>
            <div className="card"><div className="k">{t(loc, "pw.waitTotal")}</div><div className="n" style={{ fontSize: 22, color: pw.waitMin > 120 ? "#f5a524" : undefined }}>{Math.floor(pw.waitMin / 60)}h {String(pw.waitMin % 60).padStart(2, "0")}m{pw.waiting ? " ⏱" : ""}</div>{pw.waitMin > 120 ? <div className="d">{t(loc, "pw.waitOver")}</div> : null}</div>
          </div>
          {(["cmr", "pod"] as const).map((k) => (
            <div key={k} className="pwdoc"><h3>{t(loc, `pw.${k}`)}</h3>
              <div className="thumbs">{pw.files.filter((f) => f.kind === k).map((f, i) => <a key={f.id} href={f.src} target="_blank" rel="noreferrer"><img src={f.src} alt={`${k.toUpperCase()} ${i + 1}`} loading="lazy" /></a>)}{!pw.files.some((f) => f.kind === k) ? <span className="hint">{t(loc, "pw.none")}</span> : null}</div>
            </div>
          ))}
          {canPod ? <form action="/api/trips/pod" method="post" style={{ marginTop: 18 }}><input type="hidden" name="tripId" value={r.id} /><input type="hidden" name="received" value={pw.podReceived ? "0" : "1"} /><button className="btn sec sm">{pw.podReceived ? t(loc, "pw.podUndo") : t(loc, "pw.podMark")}</button></form> : null}
          <p className="hint">{t(loc, "pw.podHint")}</p>
        </section>
      ) : null}
      <section className="section" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn sec" href={`/vehicles/${r.vehicleId}`}>{r.vehicle.name}</Link>
        {r.invoiceNo ? <Link className="btn sec" href={`/invoices?trip=${r.id}`}>{t(loc, "trip.invoice")} {r.invoiceNo}</Link> : null}
      </section>
    </main>
  );
}
