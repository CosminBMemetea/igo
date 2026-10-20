import { pushConfig } from "@/lib/push";
import { fcmConfig } from "@/lib/fcm";
import { apnsConfig } from "@/lib/apns";
import { cookies } from "next/headers";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, t, type MsgKey } from "@/lib/i18n";
import { dbConfigured, store } from "@/lib/store";
import { ADMIN_FIRM_COOKIE } from "@/lib/tenant";
import { emailProvider } from "@/lib/email";
import { blobConfigured } from "@/lib/files";
import { LT, lfill } from "@/lib/lead-i18n";
import { firmByRef, refCode } from "@/lib/referral";

export const dynamic = "force-dynamic";
/** Admin (ADMIN_EMAIL): toate firmele + cererile „Asistență Querra”. Middleware blochează ruta pentru alte roluri. */
export default async function Admin(
  props: { searchParams: Promise<{ rem?: string; te?: string; id?: string; msg?: string; del?: string; e?: string; deleted?: string; n?: string; left?: string }> }
) {
  const searchParams = await props.searchParams;
  const { loc } = (await getPrefs());
  const s = store();
  const [firms, reqs, mails, leads] = await Promise.all([s.firms(), s.support(), s.emails(50), s.leads()]);
  const LL = LT[loc], referred = firms.filter((f) => f.referredBy);
  const mailOn = !!emailProvider(), webPushOn = !!pushConfig(), applePushOn = !!apnsConfig(), androidPushOn = !!fcmConfig();
  const jobs = await s.notificationJobs();
  const rem = searchParams.rem?.split("-").map(Number);
  const sp = searchParams, delFirm = sp.del ? firms.find((f) => f.id === sp.del) ?? null : null, delCounts = delFirm ? await s.firmCounts(delFirm.id) : {};
  const cur = (await cookies()).get(ADMIN_FIRM_COOKIE)?.value ?? "demo";
  const name = (id: string | null) => firms.find((f) => f.id === id)?.name ?? "—";
  return (
    <main>
      <div className="eyebrow fade" style={{ color: "#8b5cf6" }}>{t(loc, "rl.admin")}</div>
      <h1 className="h1 fade">{t(loc, "adm.title")}</h1>
      <p className="sub fade d1">{dbConfigured() ? t(loc, "adm.dbOk") : t(loc, "db.missing")}</p>
      {sp.deleted ? <p className="msg ok" role="status">{t(loc, "adm.deleted", { name: sp.deleted })} {sp.n ? `(${sp.n})` : ""}{sp.left && sp.left !== "0" ? ` · ⚠ ${sp.left}` : ""}</p> : null}
      {delFirm ? (
        <section className="section adm-delbox" id="del">
          <div className="eyebrow" style={{ color: "var(--neg)" }}>{t(loc, "adm.delTitle")}</div>
          <h2 style={{ margin: "6px 0" }}>{delFirm.name}{delFirm.cui ? ` · ${delFirm.cui}` : ""}</h2>
          <p className="sub" style={{ fontSize: 14 }}>{t(loc, "adm.delSub")}</p>
          <ul className="adm-counts">{Object.entries(delCounts).filter(([, n]) => n).map(([k, n]) => <li key={k}><b>{n}</b> {k}</li>)}</ul>
          {sp.e === "delname" ? <p className="msg err" role="alert">{t(loc, "adm.delName")}</p> : null}
          <form action="/api/admin/firm/delete" method="post" className="sheet">
            <input type="hidden" name="id" value={delFirm.id} />
            <label className="lf"><span>{t(loc, "adm.delType", { name: delFirm.name })}</span><input name="confirm" autoComplete="off" required placeholder={delFirm.name} /></label>
            <div className="invrow"><button className="btn pri danger">{t(loc, "adm.delYes")}</button><a className="btn sec" href="/admin#firms">{t(loc, "drv.endNo")}</a></div>
          </form>
        </section>
      ) : null}
      <section className="section" id="firms">
        <div className="eyebrow">{t(loc, "adm.firms", { n: firms.length })}</div>
        <div className="list" style={{ marginTop: 16 }}>
          <div className={`it${cur === "demo" ? " on" : ""}`}>
            <div><div className="t">{t(loc, "adm.demoFirm")}</div><div className="m">{t(loc, "adm.demoFirmSub")}</div></div>
            <form action="/api/admin/firm" method="post"><input type="hidden" name="id" value="demo" /><button className="btn sec sm">{cur === "demo" ? "✓" : t(loc, "rl.viewAs")}</button></form>
          </div>
          {firms.map((f) => (
            <div key={f.id} className={`it${cur === f.id ? " on" : ""}`}>
              <div style={{ minWidth: 0 }}><div className="t">{f.name}{f.cui ? ` · ${f.cui}` : ""} <span className="badge" title="ref">{refCode(f.id)}</span></div><div className="m">{t(loc, "adm.firmMeta", { trucks: f.trucks, users: f.users })} · {fmtDate(loc, f.createdAt.slice(0, 10), true)}{f.demoMode ? ` · ${t(loc, "firm.demoOn")}` : ""}</div></div>
              <div className="invrow"><form action="/api/admin/firm" method="post"><input type="hidden" name="id" value={f.id} /><button className="btn sec sm">{cur === f.id ? "✓" : t(loc, "rl.viewAs")}</button></form><a className="btn sec sm adm-del" href={`/admin?del=${f.id}#del`}>{t(loc, "adm.del")}</a></div>
            </div>
          ))}
          {!firms.length ? <div className="empty"><p>{t(loc, "adm.noFirms")}</p></div> : null}
        </div>
      </section>
      <section className="section" id="leads">
        <div className="eyebrow">{lfill(LL.admLeads, { n: leads.length })}</div>
        <div className="list" style={{ marginTop: 16 }}>
          {leads.map((l) => (
            <div key={l.id} className="it" style={{ cursor: "default" }}>
              <div style={{ minWidth: 0 }}>
                <div className="t">{l.firm} · {l.trucks ?? "—"} 🚚 · {l.person}</div>
                <div className="m"><a className="lnk" href={`tel:${l.phone}`}>{l.phone}</a> · <a className="lnk" href={`mailto:${l.email}`}>{l.email}</a> · {LL.card}: {l.fuelCard === "other" ? LL.cardOther : l.fuelCard === "none" ? LL.cardNone : l.fuelCard ?? "—"} · GPS: {l.gps == null ? "—" : l.gps ? LL.yes : LL.no}{l.gpsProvider ? ` (${l.gpsProvider})` : ""}</div>
                <div className="m">{fmtDate(loc, l.createdAt.slice(0, 10), true)} · {l.source ?? "—"}{l.referralCode ? ` · ref ${l.referralCode}${firmByRef(firms, l.referralCode) ? ` (${firmByRef(firms, l.referralCode)!.name})` : ""}` : ""}{l.utm ? ` · ${l.utm}` : ""} · {l.locale}</div>
              </div>
              <span className="badge acc">{t(loc, "adm.new")}</span>
            </div>
          ))}
          {!leads.length ? <div className="empty"><p>{LL.admNoLeads}</p></div> : null}
        </div>
      </section>
      <section className="section" id="referrals">
        <div className="eyebrow">{lfill(LL.admRefs, { n: referred.length })}</div>
        <div className="list" style={{ marginTop: 16 }}>
          {referred.map((f) => <div key={f.id} className="it" style={{ cursor: "default" }}><div><div className="t">{f.name}</div><div className="m">{lfill(LL.admRefBy, { by: firmByRef(firms, f.referredBy)?.name ?? f.referredBy ?? "—" })} · {fmtDate(loc, f.createdAt.slice(0, 10), true)}</div></div></div>)}
          {!referred.length ? <div className="empty"><p>{LL.admNoRefs}</p></div> : null}
        </div>
      </section>
      <section className="section" id="support">
        <div className="eyebrow">{t(loc, "adm.requests", { n: reqs.length })}</div>
        <div className="list" style={{ marginTop: 16 }}>
          {reqs.map((r) => (
            <div key={r.id} className="it" style={{ cursor: "default" }}>
              <div style={{ minWidth: 0 }}>
                <div className="t">{r.name} · <a className="lnk" href={`tel:${r.phone}`}>{r.phone}</a></div>
                <div className="m">{name(r.firmId)}{r.email ? ` · ${r.email}` : ""} · {r.slot ? t(loc, `sup.slot.${r.slot}` as MsgKey) : "—"} · {fmtDate(loc, r.createdAt.slice(0, 10), true)}</div>
                {r.message ? <div className="m" style={{ marginTop: 6, color: "var(--fg)" }}>{r.message}</div> : null}
              </div>
              <span className="badge acc">{t(loc, "adm.new")}</span>
            </div>
          ))}
          {!reqs.length ? <div className="empty"><p>{t(loc, "adm.noRequests")}</p></div> : null}
        </div>
      </section>
      <section className="section" id="test-email">
        <div className="head"><h2>{t(loc, "adm.testMail")}</h2></div>
        <form action="/api/admin/test-email" method="post" className="sheet" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label className="lf" style={{ flex: 1, minWidth: 220, margin: 0 }}><span>{t(loc, "adm.testMailTo")}</span><input name="to" type="email" required defaultValue={process.env.ADMIN_EMAIL ?? ""} /></label>
          <button className="btn sec">{t(loc, "adm.testMailSend")}</button>
        </form>
        {searchParams.te === "sent" ? <p className="msg ok">{t(loc, "adm.testMail.sent", { id: searchParams.id ?? "" })}</p>
          : searchParams.te === "err" ? <p className="msg err">{t(loc, "adm.testMail.err", { msg: searchParams.msg ?? "" })}</p>
          : searchParams.te === "none" ? <p className="msg warn">{t(loc, "adm.testMail.none")}</p>
          : searchParams.te === "wait" ? <p className="msg warn">{t(loc, "adm.testMail.wait")}</p>
          : searchParams.te === "bad" ? <p className="msg err">{t(loc, "adm.testMail.bad")}</p> : null}
      </section>
      <section className="section" id="emails">
        <div className="head"><h2>{t(loc, "adm.reminders")}</h2>
          <form action="/api/admin/reminders" method="post"><button className="btn sec sm">{t(loc, "adm.runNow")}</button></form>
        </div>
        <p className="sub" style={{ fontSize: 14 }}>{t(loc, "adm.cronInfo")}</p>
        {rem && rem.length === 4 ? <p className="msg ok">{t(loc, "adm.ran", { n: rem[0], sent: rem[1], queued: rem[2], failed: rem[3] })}</p> : null}
        <div className="sheet" style={{ marginTop: 16, overflowWrap: "anywhere" }}>
          <strong>Livrarea notificărilor</strong><p className="sub">Email: {mailOn ? "configurat" : "neconfigurat"} · Web Push: {webPushOn ? "configurat" : "neconfigurat"} · Apple Push: {applePushOn ? "configurat" : "neconfigurat"} · Android FCM: {androidPushOn ? "configurat" : "neconfigurat"}</p>
          <p className="sub">Retry: programează /api/cron/deliveries la 5 minute. Jobul zilnic este doar rezervă; nu garantează reîncercări rapide.</p>
          {["reminders", "deliveries"].map(name => { const job = jobs.find(j => j.name === name), stale = !job?.finishedAt || Date.now() - Date.parse(job.finishedAt) > (name === "reminders" ? 27 * 3600000 : 15 * 60000); return <p key={name} className={`msg ${stale || job?.error ? "warn" : "ok"}`}>{name}: {job ? job.error ? "Execuție eșuată" : !job.finishedAt ? "Execuție începută, încă neconfirmată" : `Ultima confirmare ${new Date(job.finishedAt).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}` : "Nicio execuție înregistrată"}{stale ? " · verifică programarea" : ""}</p>; })}
        </div>
        {!mailOn ? <p className="msg warn">{t(loc, "adm.noMail")}</p> : null}
        {!blobConfigured() ? <p className="msg warn">{t(loc, "files.noBlob")}</p> : null}
        <div className="eyebrow" style={{ marginTop: 18 }}>{t(loc, "adm.outbox", { n: mails.length })}</div>
        <div className="list" style={{ marginTop: 12 }}>
          {mails.map((m) => (
            <div key={m.id} className="it" style={{ cursor: "default" }}>
              <div style={{ minWidth: 0 }}><div className="t">{m.subject}</div><div className="m">{m.channel === "push" ? "Push" : m.to} · {name(m.firmId)} · {fmtDate(loc, m.createdAt.slice(0, 10), true)}{m.error ? ` · ${m.error}` : ""} · {m.attempts} încercări{m.status === "queued" && m.attempts > 0 ? ` · Retry: ${m.nextAttemptAt}` : ""}</div></div>
              <span className={`badge ${m.status === "sent" ? "ok" : m.status === "failed" ? "bad" : "warn"}`}>{m.status === "sent" ? "Acceptat de furnizor" : m.status === "failed" ? t(loc, "adm.mail.failed") : m.status === "cancelled" ? "Anulat (date schimbate/expirat)" : m.status === "processing" ? "În procesare" : (m.channel === "push" ? webPushOn || applePushOn || androidPushOn : mailOn) ? t(loc, "adm.mail.queued") : t(loc, "adm.mail.noProvider")}</span>
            </div>
          ))}
          {!mails.length ? <div className="empty"><p>{t(loc, "adm.noMails")}</p></div> : null}
        </div>
      </section>
    </main>
  );
}
