import { cookies } from "next/headers";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, t, type MsgKey } from "@/lib/i18n";
import { dbConfigured, store } from "@/lib/store";
import { ADMIN_FIRM_COOKIE } from "@/lib/tenant";
import { emailProvider } from "@/lib/email";
import { blobConfigured } from "@/lib/files";

export const dynamic = "force-dynamic";
/** Admin (ADMIN_EMAIL): toate firmele + cererile „Asistență Querra”. Middleware blochează ruta pentru alte roluri. */
export default async function Admin({ searchParams }: { searchParams: { rem?: string; te?: string; id?: string; msg?: string } }) {
  const { loc } = getPrefs();
  const s = store();
  const [firms, reqs, mails] = await Promise.all([s.firms(), s.support(), s.emails(50)]);
  const mailOn = !!emailProvider();
  const rem = searchParams.rem?.split("-").map(Number);
  const cur = cookies().get(ADMIN_FIRM_COOKIE)?.value ?? "demo";
  const name = (id: string | null) => firms.find((f) => f.id === id)?.name ?? "—";
  return (
    <main>
      <div className="eyebrow fade" style={{ color: "#8b5cf6" }}>{t(loc, "rl.admin")}</div>
      <h1 className="h1 fade">{t(loc, "adm.title")}</h1>
      <p className="sub fade d1">{dbConfigured() ? t(loc, "adm.dbOk") : t(loc, "db.missing")}</p>
      <section className="section" id="firms">
        <div className="eyebrow">{t(loc, "adm.firms", { n: firms.length })}</div>
        <div className="list" style={{ marginTop: 16 }}>
          <div className={`it${cur === "demo" ? " on" : ""}`}>
            <div><div className="t">{t(loc, "adm.demoFirm")}</div><div className="m">{t(loc, "adm.demoFirmSub")}</div></div>
            <form action="/api/admin/firm" method="post"><input type="hidden" name="id" value="demo" /><button className="btn sec sm">{cur === "demo" ? "✓" : t(loc, "rl.viewAs")}</button></form>
          </div>
          {firms.map((f) => (
            <div key={f.id} className={`it${cur === f.id ? " on" : ""}`}>
              <div style={{ minWidth: 0 }}><div className="t">{f.name}{f.cui ? ` · ${f.cui}` : ""}</div><div className="m">{t(loc, "adm.firmMeta", { trucks: f.trucks, users: f.users })} · {fmtDate(loc, f.createdAt.slice(0, 10), true)}{f.demoMode ? ` · ${t(loc, "firm.demoOn")}` : ""}</div></div>
              <form action="/api/admin/firm" method="post"><input type="hidden" name="id" value={f.id} /><button className="btn sec sm">{cur === f.id ? "✓" : t(loc, "rl.viewAs")}</button></form>
            </div>
          ))}
          {!firms.length ? <div className="empty"><p>{t(loc, "adm.noFirms")}</p></div> : null}
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
        {!mailOn ? <p className="msg warn">{t(loc, "adm.noMail")}</p> : null}
        {!blobConfigured() ? <p className="msg warn">{t(loc, "files.noBlob")}</p> : null}
        <div className="eyebrow" style={{ marginTop: 18 }}>{t(loc, "adm.outbox", { n: mails.length })}</div>
        <div className="list" style={{ marginTop: 12 }}>
          {mails.map((m) => (
            <div key={m.id} className="it" style={{ cursor: "default" }}>
              <div style={{ minWidth: 0 }}><div className="t">{m.subject}</div><div className="m">{m.to} · {name(m.firmId)} · {fmtDate(loc, m.createdAt.slice(0, 10), true)}{m.error ? ` · ${m.error}` : ""}</div></div>
              <span className={`badge ${m.status === "sent" ? "ok" : m.status === "failed" ? "bad" : "warn"}`}>{m.status === "sent" ? t(loc, "adm.mail.sent") : m.status === "failed" ? t(loc, "adm.mail.failed") : mailOn ? t(loc, "adm.mail.queued") : t(loc, "adm.mail.noProvider")}</span>
            </div>
          ))}
          {!mails.length ? <div className="empty"><p>{t(loc, "adm.noMails")}</p></div> : null}
        </div>
      </section>
    </main>
  );
}
