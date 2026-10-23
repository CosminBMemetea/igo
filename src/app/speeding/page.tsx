import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { tri, fmtNum } from "@/lib/i18n";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { speedFilter, speedReport, fmtLocal, SPEED_PERIODS } from "@/lib/speed-report";
import { DemoBadge } from "@/components/DemoBadge";
import SpeedMap from "@/components/SpeedMap";
export const dynamic = "force-dynamic";
/** Raport depășiri ale limitei setate de patron: listă + hartă + CSV. Doar patron/admin; demo = gol, doar citire. */
export default async function Speeding(props: { searchParams: Promise<{ days?: string; truck?: string; driver?: string }> }) {
  const q = await props.searchParams, { loc, theme } = await getPrefs(), tn = await tenant();
  if (tn.role === "driver") redirect("/driver");
  const f = speedFilter(q), real = tn.firm && !tn.demo;
  const r = real ? await speedReport(store(), tn.firm!.id, f) : { rows: [], trucks: [], drivers: [] };
  const limit = real ? await store().speedSettings(tn.firm!.id) : null;
  const qs = new URLSearchParams({ days: String(f.days), ...(f.truckId ? { truck: f.truckId } : {}), ...(f.userId ? { driver: f.userId } : {}) }).toString();
  const dur = (s: number) => s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
  return <main className="sp-page">
    <div className="eyebrow fade">{tri(loc, "Siguranță|Safety|Bezpieczeństwo")} {tn.demo ? <DemoBadge loc={loc} /> : null}</div>
    <h1 className="h1 fade">{tri(loc, "Depășiri ale limitei de viteză|Speed limit warnings|Przekroczenia limitu prędkości")}</h1>
    <p className="sub fade d1">{tri(loc, "Avertizare la depășirea limitei setate de tine, din GPS-ul telefonului șoferului. Nu este o măsurare oficială și nu ține cont de limita drumului.|Warnings when the limit you set is exceeded, from the driver's phone GPS. Not an official measurement and it does not know the road's limit.|Ostrzeżenia po przekroczeniu ustawionego przez Ciebie limitu, z GPS telefonu kierowcy. To nie pomiar urzędowy i nie zna limitu drogi.")}
      {limit ? <> {tri(loc, "Limita ta|Your limit|Twój limit")}: <b>{limit.limitKmh} km/h</b> · <Link className="link" href="/settings#speed">{tri(loc, "Schimbă|Change|Zmień")}</Link></> : null}</p>
    {tn.demo ? <p className="hint" style={{ marginTop: 10 }}>{tri(loc, "În demo nu avem date reale de viteză. La firmele reale, evenimentele apar aici după primele ture cu aplicația șoferului.|There is no real speed data in the demo. For real companies, events appear here after the first shifts with the driver app.|W demo nie ma prawdziwych danych o prędkości. W firmach zdarzenia pojawią się tu po pierwszych zmianach z aplikacją kierowcy.")}</p> : null}
    {real ? <form className="sp-filter" method="get">
      <label className="lf"><span>{tri(loc, "Perioadă|Period|Okres")}</span><select name="days" defaultValue={String(f.days)}>{SPEED_PERIODS.map(d => <option key={d} value={d}>{d} {tri(loc, "zile|days|dni")}</option>)}</select></label>
      <label className="lf"><span>{tri(loc, "Camion|Truck|Pojazd")}</span><select name="truck" defaultValue={f.truckId}><option value="">{tri(loc, "Toate|All|Wszystkie")}</option>{r.trucks.map(t => <option key={t.id} value={t.id}>{t.plate}</option>)}</select></label>
      <label className="lf"><span>{tri(loc, "Șofer|Driver|Kierowca")}</span><select name="driver" defaultValue={f.userId}><option value="">{tri(loc, "Toți|All|Wszyscy")}</option>{r.drivers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <div className="invrow"><button className="btn pri sm">{tri(loc, "Filtrează|Filter|Filtruj")}</button>{r.rows.length ? <a className="btn sec sm" href={`/api/speeding/csv?${qs}`} download>CSV</a> : null}</div>
    </form> : null}
    <SpeedMap theme={theme} pins={r.rows.map(({ e, plate }) => ({ id: e.id, lat: e.lat, lng: e.lng, over: e.maxKmh - e.limitKmh, label: `${plate} · ${Math.round(e.maxKmh)}/${e.limitKmh} km/h` }))} />
    <section className="section">
      <div className="head"><h2>{fmtNum(loc, r.rows.length)} {tri(loc, "evenimente|events|zdarzeń")}</h2></div>
      {r.rows.length ? <div className="list">{r.rows.map(({ e, plate, driver }) => <div key={e.id} className="it sp-row">
        <div style={{ minWidth: 0 }}><div className="t">{plate}{driver ? ` · ${driver}` : ""}</div><div className="m">{fmtLocal(e.startAt).slice(0, 16)} · {dur(e.durationS)}{e.open ? ` · ${tri(loc, "în curs|ongoing|w toku")}` : ""}</div></div>
        <b className={e.maxKmh - e.limitKmh >= 10 ? "neg" : ""}>{Math.round(e.maxKmh)}<small>/{e.limitKmh} km/h</small></b>
      </div>)}</div> : <p className="sub">{tri(loc, "Nicio depășire în perioada aleasă.|No warnings in this period.|Brak przekroczeń w wybranym okresie.")}</p>}
    </section>
  </main>;
}
