import QRCode from "qrcode";
import Link from "next/link";
import { headers } from "next/headers";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, fmtMoney, t, type MsgKey } from "@/lib/i18n";
import { store, DOC_TYPES } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { STEPS, setupState, type Step } from "@/lib/setup";
import { inviteToken } from "@/lib/invite";
import { CopyLink } from "@/components/CopyLink";

export const dynamic = "force-dynamic";
const ERR: Record<string, MsgKey> = { firm: "su.e.firm", cui: "su.e.cui", plate: "set.e.plate", vin: "set.e.vin", num: "set.e.num", dup: "set.e.dup", name: "set.e.name", phone: "join.e.phone", doc: "set.e.doc", trip: "set.e.trip", nofirm: "set.e.nofirm" };
export default async function Setup({ searchParams }: { searchParams: { step?: string; e?: string; ok?: string; inv?: string } }) {
  const { loc } = getPrefs();
  const f = await writableFirm();
  if (!f) return <main className="login"><h1 className="h1">{t(loc, "set.title")}</h1><p className="sub">{t(loc, "set.e.nofirm")}</p><Link className="btn sec" href="/admin" style={{ marginTop: 24 }}>{t(loc, "adm.title")}</Link></main>;
  const st = await setupState(store(), f.id);
  const q = Number(searchParams.step);
  const step: Step = (STEPS as readonly number[]).includes(q) ? (q as Step) : st.next ?? 5;
  const err = searchParams.e ? ERR[searchParams.e] : null;
  const h = headers(), origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const secret = process.env.SESSION_SECRET ?? "";
  const links = await Promise.all(st.invites.map(async (i) => {
    const url = `${origin}/join?t=${encodeURIComponent(await inviteToken(f.id, i.id, secret))}`;
    return { ...i, url, qr: !i.usedAt && !i.revokedAt ? await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : "" };
  }));
  const plate = (id: string) => st.trucks.find((x) => x.id === id)?.plate ?? "—";
  const nextHref = step < 5 ? `/setup?step=${step + 1}` : "/";
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main className="setup">
      <div className="eyebrow fade">{t(loc, "set.eyebrow", { firm: st.firm!.name })}</div>
      <h1 className="h1 fade">{t(loc, `set.s${step}.title` as MsgKey)}</h1>
      <p className="sub fade d1">{t(loc, `set.s${step}.sub` as MsgKey)}</p>
      <ol className="steps fade d1" aria-label={t(loc, "set.progress", { n: st.n })}>
        {STEPS.map((k) => <li key={k} className={`${st.done[k] ? "done" : ""}${k === step ? " on" : ""}`}><Link href={`/setup?step=${k}`}><b>{st.done[k] ? "✓" : k}</b><span>{t(loc, `set.s${k}.short` as MsgKey)}</span></Link></li>)}
      </ol>
      <div className="pbar fade d1"><i style={{ width: `${(st.n / 5) * 100}%` }} /></div>
      <p className="hint">{t(loc, "set.progress", { n: st.n })}</p>
      {err ? <p className="msg err">{t(loc, err)}</p> : searchParams.ok ? <p className="msg ok">{t(loc, "set.saved")}</p> : null}

      <section className="sgrid">
        {step === 1 ? (
          <form className="sheet" action="/api/setup/firm" method="post">
            <div className="lf"><span>{t(loc, "set.lang")}</span>
              <div className="radio">{([["ro", "🇷🇴 Română"], ["en", "🇬🇧 English"], ["pl", "🇵🇱 Polski"]] as const).map(([l, n]) => <label key={l}><input type="radio" name="locale" value={l} defaultChecked={loc === l} /><i>{n}</i></label>)}</div>
            </div>
            <label className="lf"><span>{t(loc, "su.firm")}</span><input name="name" required defaultValue={st.firm!.name} maxLength={120} /></label>
            <label className="lf"><span>{t(loc, "su.cui")}</span><input name="cui" defaultValue={st.firm!.cui ?? ""} maxLength={20} placeholder="RO12345678" /></label>
            <div className="lf"><span>{t(loc, "set.currency")}</span>
              <div className="radio">{(["RON", "EUR"] as const).map((c) => <label key={c}><input type="radio" name="currency" value={c} defaultChecked={st.firm!.currency === c} /><i>{c === "RON" ? "lei (RON)" : "€ (EUR)"}</i></label>)}</div>
            </div>
            <button className="btn pri">{t(loc, "set.saveNext")}</button>
          </form>
        ) : null}

        {step === 2 ? (
          <>
            <form className="sheet" action="/api/setup/truck" method="post">
              <label className="lf"><span>{t(loc, "set.plate")}</span><input name="plate" required placeholder="BH 21 QRT" maxLength={20} autoCapitalize="characters" /></label>
              <div className="two">
                <label className="lf"><span>{t(loc, "set.model")}</span><input name="model" maxLength={60} placeholder="Volvo FH 500" /></label>
                <label className="lf"><span>{t(loc, "set.vin")}</span><input name="vin" maxLength={20} placeholder={t(loc, "set.optional")} autoCapitalize="characters" /></label>
              </div>
              <div className="two">
                <label className="lf"><span>{t(loc, "set.tank")}</span><input name="tank" inputMode="decimal" placeholder="600" /></label>
                <label className="lf"><span>{t(loc, "set.l100")}</span><input name="l100" inputMode="decimal" placeholder="30" /></label>
              </div>
              <button className="btn pri">{t(loc, "set.addTruck")}</button>
            </form>
            <List empty={t(loc, "set.noTrucks")} items={st.trucks.map((x) => ({ id: x.id, t: x.plate, m: [x.model, x.tankL ? `${x.tankL} L` : null, x.normalL100 ? `${x.normalL100} L/100km` : null, x.vin].filter(Boolean).join(" · ") }))} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <form className="sheet" action="/api/setup/invite" method="post">
              <label className="lf"><span>{t(loc, "set.drvName")}</span><input name="name" required maxLength={80} placeholder="Ioan Pop" /></label>
              <label className="lf"><span>{t(loc, "set.drvPhone")}</span><input name="phone" type="tel" placeholder="07xx xxx xxx" /></label>
              <label className="lf"><span>{t(loc, "set.drvLang")}</span><select name="locale" defaultValue="ro"><option value="ro">🇷🇴 Română</option><option value="en">🇬🇧 English</option><option value="pl">🇵🇱 Polski</option></select></label>
              <button className="btn pri">{t(loc, "set.invite")}</button>
              <p className="hint">{t(loc, "set.inviteHint")}</p>
            </form>
            <p className="gdpr"><b>GDPR</b> · {t(loc, "priv.gdpr")}</p>
            <div className="list">
              {links.length ? links.map((i) => (
                <div key={i.id} className={`it${i.id === searchParams.inv ? " on" : ""}`}>
                  <div style={{ minWidth: 0 }}><div className="t">{i.name}</div><div className="m">{[i.phone, i.usedAt ? t(loc, "set.joined") : i.revokedAt ? t(loc, "inv.revoked") : t(loc, "set.pending")].filter(Boolean).join(" · ")}</div></div>
                  {i.usedAt ? <span className="badge ok">✓</span> : i.revokedAt ? <span className="badge bad">✕</span> : (() => {
                    const msg = t(loc, "set.waText", { firm: st.firm!.name }) + " " + i.url;
                    return (
                      <div className="invx">
                        <CopyLink url={i.url} copy={t(loc, "set.copy")} copied={t(loc, "set.copied")} wa={`https://wa.me/${i.phone ? i.phone.replace("+", "") : ""}?text=${encodeURIComponent(msg)}`} waLabel="WhatsApp" sms={`sms:${i.phone ?? ""}?&body=${encodeURIComponent(msg)}`} smsLabel="SMS" />
                        <details className="qr"><summary className="btn sec sm">{t(loc, "inv.qr")}</summary><div className="qrbox" dangerouslySetInnerHTML={{ __html: i.qr }} /><p className="hint">{t(loc, "inv.qrHint")}</p></details>
                        <div className="invrow">
                          <Link className="btn sec sm" href={`/setup?step=3&inv=${i.id}`}>{t(loc, "inv.resend")}</Link>
                          <form action="/api/setup/invite/revoke" method="post"><input type="hidden" name="id" value={i.id} /><button className="btn sec sm">{t(loc, "inv.revoke")}</button></form>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )) : <Empty text={t(loc, "set.noDrivers")} />}
            </div>
          </>
        ) : null}

        {step === 4 ? (
          st.trucks.length ? (
            <>
              <form className="sheet" action="/api/setup/doc" method="post">
                <label className="lf"><span>{t(loc, "set.truck")}</span><select name="truck">{st.trucks.map((x) => <option key={x.id} value={x.id}>{x.plate}</option>)}</select></label>
                <div className="two">
                  <label className="lf"><span>{t(loc, "set.docType")}</span><select name="type">{DOC_TYPES.map((d) => <option key={d} value={d}>{t(loc, `doc.${d}` as MsgKey)}</option>)}</select></label>
                  <label className="lf"><span>{t(loc, "docs.expires")}</span><input name="expires" type="date" required min="2000-01-01" defaultValue={today} /></label>
                </div>
                <button className="btn pri">{t(loc, "set.addDoc")}</button>
                <p className="hint">{t(loc, "set.docHint")}</p>
              </form>
              <List empty={t(loc, "set.noDocs")} items={st.docs.map((d) => ({ id: d.id, t: `${t(loc, `doc.${d.type}` as MsgKey)} · ${plate(d.truckId ?? "")}`, m: `${t(loc, "docs.expires")} ${fmtDate(loc, d.expires, true)}` }))} />
            </>
          ) : <Empty text={t(loc, "set.needTruck")} href="/setup?step=2" cta={t(loc, "set.s2.title")} />
        ) : null}

        {step === 5 ? (
          st.trucks.length ? (
            <>
              <form className="sheet" action="/api/setup/trip" method="post">
                <div className="two">
                  <label className="lf"><span>{t(loc, "set.truck")}</span><select name="truck">{st.trucks.map((x) => <option key={x.id} value={x.id}>{x.plate}</option>)}</select></label>
                  <label className="lf"><span>{t(loc, "set.date")}</span><input name="date" type="date" required defaultValue={today} /></label>
                </div>
                <label className="lf"><span>{t(loc, "set.client")}</span><input name="client" required maxLength={120} placeholder="Dedeman SRL" /></label>
                <label className="lf"><span>{t(loc, "set.route")}</span><input name="title" required maxLength={120} placeholder="Oradea → Sibiu" /></label>
                <div className="two">
                  <label className="lf"><span>km</span><input name="km" inputMode="decimal" required placeholder="330" /></label>
                  <label className="lf"><span>{t(loc, "set.revenue")}</span><input name="revenue" inputMode="decimal" required placeholder="2500" /></label>
                </div>
                <div className="two">
                  <label className="lf"><span>{t(loc, "set.litres")}</span><input name="litres" inputMode="decimal" placeholder={t(loc, "set.litresPh")} /></label>
                  <label className="lf"><span>{t(loc, "set.fuelPrice")}</span><input name="fuelPrice" inputMode="decimal" required defaultValue="7.3" /></label>
                </div>
                <div className="two">
                  <label className="lf"><span>{t(loc, "set.tolls")}</span><input name="tolls" inputMode="decimal" placeholder="0" /></label>
                  <label className="lf"><span>{t(loc, "set.driverCost")}</span><input name="driver" inputMode="decimal" placeholder="0" /></label>
                </div>
                <button className="btn pri">{t(loc, "set.addTrip")}</button>
              </form>
              <div>
                <List empty={t(loc, "set.noTrips")} items={st.trips.map((r) => ({ id: r.id, t: `${r.title} · ${r.client}`, m: `${plate(r.truckId)} · ${fmtDate(loc, r.date, true)}`, v: fmtMoney(loc, r.revenue - r.litres * r.fuelPrice - r.tolls - r.driverCost - r.other) }))} />
                <div className="sheet csv">
                  <div className="t">{t(loc, "set.csvTitle")}</div>
                  <p className="sub" style={{ fontSize: 14 }}>{t(loc, "set.csvSub")}</p>
                  <Link className="btn pri sm" href="/import">{t(loc, "imp.open")}</Link>
                </div>
              </div>
            </>
          ) : <Empty text={t(loc, "set.needTruck")} href="/setup?step=2" cta={t(loc, "set.s2.title")} />
        ) : null}
      </section>

      <div className="setup-nav">
        {step > 1 ? <Link className="btn sec" href={`/setup?step=${step - 1}`}>{t(loc, "set.back")}</Link> : <span />}
        {step < 5 ? <Link className="btn sec" href={nextHref}>{st.done[step] ? t(loc, "set.next") : t(loc, "set.skip")}</Link>
          : <form action="/api/setup/finish" method="post"><button className="btn pri">{t(loc, "set.finish")}</button></form>}
      </div>
      <Link href="/support" className="help"><b>{t(loc, "sup.title")}</b><span>{t(loc, "sup.cta")}</span></Link>
    </main>
  );
}
function List({ items, empty }: { items: { id: string; t: string; m: string; v?: string }[]; empty: string }) {
  if (!items.length) return <Empty text={empty} />;
  return <div className="list">{items.map((x) => <div key={x.id} className="it"><div style={{ minWidth: 0 }}><div className="t">{x.t}</div><div className="m">{x.m}</div></div>{x.v ? <b className="num">{x.v}</b> : <span className="badge ok">✓</span>}</div>)}</div>;
}
function Empty({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return <div className="empty"><p>{text}</p>{href ? <Link className="btn pri" href={href}>{cta}</Link> : null}</div>;
}
