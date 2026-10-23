import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { t, tri, type MsgKey } from "@/lib/i18n";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
export const dynamic = "force-dynamic";
/** Cont și firmă: un singur loc pentru date firmă, camioane, șoferi, parolă, date personale (GDPR). */
const ERR: Record<string, MsgKey> = { firm: "stg.e.firm", cui: "stg.e.cui", plate: "stg.e.plate", num: "stg.e.num", dup: "stg.e.dup", pw: "stg.e.pw", email: "stg.e.email", emaildup: "stg.e.emaildup", locked: "acct.locked", speed: "stg.e.speed", demo: "stg.e.demo" };
export default async function Settings(props: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const searchParams = await props.searchParams;
  const { loc } = (await getPrefs()), tn = await tenant();
  if (tn.role === "driver") redirect("/driver");
  const me = tn.uid ? await store().userById(tn.uid).catch(() => null) : null;
  const trucks = tn.firm && !tn.demo ? await store().trucks(tn.firm.id) : [], sp = tn.firm && !tn.demo ? await store().speedSettings(tn.firm.id) : null, err = ERR[searchParams.e ?? ""];
  const rows: [MsgKey, MsgKey, string][] = [["stg.drivers", "stg.driversSub", "/drivers"], ["stg.docs", "stg.docsSub", "/documents"]];
  return (
    <main className="stg">
      <div className="eyebrow fade">{t(loc, "stg.eyebrow")}</div>
      <h1 className="h1 fade">{t(loc, "stg.title")}</h1>
      <p className="sub fade d1">{tn.firm?.name ?? ""}{me?.email ? ` · ${me.email}` : ""}</p>
      {searchParams.ok ? <p className="msg ok" role="status">{t(loc, "stg.saved")}</p> : null}
      {err ? <p className="msg err" role="alert">{t(loc, err).replace("{m}", "15")}</p> : null}
      {tn.firm && !tn.demo ? <>
        <section className="section fade d1" id="firm"><div className="head"><h2>{t(loc, "stg.firm")}</h2></div>
          <form className="sheet" action="/api/setup/firm" method="post"><input type="hidden" name="ret" value="settings" />
            <label className="lf"><span>{t(loc, "su.firm")}</span><input name="name" required maxLength={120} defaultValue={tn.firm.name} /></label>
            <label className="lf"><span>{t(loc, "su.cui")}</span><input name="cui" maxLength={20} defaultValue={tn.firm.cui ?? ""} placeholder="RO12345678" /></label>
            <div className="radio">{(["RON"] as const).map((c) => <label key={c}><input type="radio" name="currency" value={c} defaultChecked={tn.firm!.currency === c} /><i>{c === "RON" ? "lei (RON)" : "€ (EUR)"}</i></label>)}</div>
            <button className="btn pri">{t(loc, "stg.save")}</button>
          </form>
        </section>
        <section className="section fade d1" id="trucks"><div className="head"><h2>{t(loc, "stg.trucks")}</h2><Link className="link" href="/trucks">+ {t(loc, "stg.addTruck")}</Link></div>
          <div className="stg-trucks">{trucks.map((x) => (
            <details key={x.id} className="stg-truck"><summary><b>{x.plate}</b><span>{[x.model, x.tankL ? `${x.tankL} L` : null, x.normalL100 ? `${x.normalL100} L/100` : null, x.archivedAt ? t(loc, "stg.archived") : null].filter(Boolean).join(" · ")}</span><i aria-hidden>✎</i></summary>
              <form className="sheet" action="/api/settings/truck" method="post"><input type="hidden" name="id" value={x.id} />
                <label className="lf"><span>{t(loc, "stg.plate")}</span><input name="plate" required maxLength={20} defaultValue={x.plate} /></label>
                <label className="lf"><span>{t(loc, "stg.model")}</span><input name="model" maxLength={60} defaultValue={x.model ?? ""} /></label>
                <div className="stg-2"><label className="lf"><span>{t(loc, "stg.tank")}</span><input name="tank" inputMode="numeric" defaultValue={x.tankL ?? ""} /></label><label className="lf"><span>{t(loc, "stg.l100")}</span><input name="l100" inputMode="decimal" defaultValue={x.normalL100 ?? ""} /></label></div>
                <div className="invrow"><button className="btn pri sm">{t(loc, "stg.save")}</button><Link className="btn sec sm" href={`/vehicles/${x.id}?tab=costs`}>{t(loc, "stg.costsArchive")}</Link></div>
              </form>
            </details>))}</div>
        </section>
        {sp ? <section className="section fade d1" id="speed"><div className="head"><h2>{tri(loc, "Limită de viteză|Speed limit|Limit prędkości")}</h2></div>
          <form className="sheet" action="/api/settings/speed" method="post">
            <p className="hint" style={{ marginTop: 0 }}>{tri(loc, "Avertizare la depășirea limitei setate de tine. Șoferul primește sunet, vibrație și mesaj în aplicație. Viteza vine din GPS-ul telefonului; nu e o măsurare oficială și nu garantează evitarea amenzilor.|A warning when the limit you set is exceeded. The driver gets a sound, vibration and a banner in the app. Speed comes from the phone GPS; it is not an official measurement and does not guarantee avoiding fines.|Ostrzeżenie po przekroczeniu ustawionego przez Ciebie limitu. Kierowca dostaje dźwięk, wibrację i komunikat w aplikacji. Prędkość pochodzi z GPS telefonu; to nie jest pomiar urzędowy i nie gwarantuje uniknięcia mandatów.")}</p>
            <label className="lf"><span>{tri(loc, "Limită implicită (km/h)|Default limit (km/h)|Domyślny limit (km/h)")}</span><input name="limit" inputMode="numeric" required defaultValue={sp.limitKmh} pattern="[0-9]{2,3}" /></label>
            <div className="stg-2">
              <label className="lf"><span>{tri(loc, "Alertă patron peste (km/h)|Owner alert over (km/h)|Alert właściciela powyżej (km/h)")}</span><input name="over" inputMode="numeric" required defaultValue={sp.ownerOverKmh} pattern="[0-9]{1,2}" /></label>
              <label className="lf"><span>{tri(loc, "…mai mult de (secunde)|…for longer than (seconds)|…dłużej niż (sekundy)")}</span><input name="after" inputMode="numeric" required defaultValue={sp.ownerAfterS} pattern="[0-9]{2,3}" /></label>
            </div>
            <label className="chk"><input type="checkbox" name="alerts" value="on" defaultChecked={sp.ownerAlerts} /> <span>{tri(loc, "Trimite-mi push și email|Send me push and email|Wysyłaj mi push i email")}</span></label>
            {trucks.filter(x => !x.archivedAt).length ? <details className="stg-truck"><summary><b>{tri(loc, "Limită pe camion (opțional)|Per-truck limit (optional)|Limit dla pojazdu (opcjonalnie)")}</b><span>{Object.keys(sp.truckLimits).length || ""}</span><i aria-hidden>✎</i></summary>
              <div className="stg-2">{trucks.filter(x => !x.archivedAt).map(x => <label key={x.id} className="lf"><span>{x.plate}</span><input name={`t_${x.id}`} inputMode="numeric" placeholder={String(sp.limitKmh)} defaultValue={sp.truckLimits[x.id] ?? ""} pattern="[0-9]{2,3}" /></label>)}</div>
            </details> : null}
            <div className="invrow"><button className="btn pri">{t(loc, "stg.save")}</button><Link className="btn sec" href="/speeding">{tri(loc, "Raport depășiri|Speeding report|Raport przekroczeń")}</Link></div>
          </form>
        </section> : null}
      </> : null}
      <div className="list fade d1" style={{ marginTop: 20 }}>
        {rows.map(([a, b, h]) => <Link key={h} href={h} className="it"><div style={{ minWidth: 0 }}><div className="t">{t(loc, a)}</div><div className="m">{t(loc, b)}</div></div><span aria-hidden>→</span></Link>)}
      </div>
      {me?.email ? (
        <section className="section fade d2"><div className="head"><h2>{t(loc, "stg.pw")}</h2></div>
          <form className="sheet" id="email" action="/api/settings/email" method="post" style={{ marginBottom: 12 }}>
            <label className="lf"><span>{t(loc, "stg.newEmail")}</span><input name="email" type="email" required maxLength={200} defaultValue={me.email} autoComplete="email" /></label>
            <label className="lf"><span>{t(loc, "stg.curPw")}</span><input name="password" type="password" required autoComplete="current-password" /></label>
            <button className="btn sec">{t(loc, "stg.changeEmail")}</button>
          </form>
          <form className="sheet" action="/api/auth/forgot" method="post"><input type="hidden" name="email" value={me.email} /><p className="hint" style={{ marginTop: 0 }}>{t(loc, "stg.pwSub")}</p><button className="btn sec">{t(loc, "rst.send")}</button></form>
        </section>
      ) : null}
      <section className="section fade d2"><div className="head"><h2>{t(loc, "stg.gdpr")}</h2></div>
        <p className="sub" style={{ fontSize: 14 }}>{t(loc, "stg.gdprSub")}</p>
        <Link className="btn sec" href="/support" style={{ marginTop: 10 }}>{t(loc, "stg.gdprCta")}</Link>
      </section>
      <form action="/api/auth/logout" method="post" style={{ marginTop: 28 }}><button className="btn sec">{t(loc, "stg.logout")}</button></form>
    </main>
  );
}
