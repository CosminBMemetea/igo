import { cookies } from "next/headers";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, t, type MsgKey } from "@/lib/i18n";
import { dbConfigured, store } from "@/lib/store";
import { ADMIN_FIRM_COOKIE } from "@/lib/tenant";

export const dynamic = "force-dynamic";
/** Admin (ADMIN_EMAIL): toate firmele + cererile „Asistență Querra”. Middleware blochează ruta pentru alte roluri. */
export default async function Admin() {
  const { loc } = getPrefs();
  const s = store();
  const [firms, reqs] = await Promise.all([s.firms(), s.support()]);
  const cur = cookies().get(ADMIN_FIRM_COOKIE)?.value ?? "demo";
  const name = (id: string | null) => firms.find((f) => f.id === id)?.name ?? "—";
  return (
    <main>
      <div className="eyebrow fade">{t(loc, "acct.admin")}</div>
      <h1 className="h1 fade">{t(loc, "adm.title")}</h1>
      <p className="sub fade d1">{dbConfigured() ? t(loc, "adm.dbOk") : t(loc, "db.missing")}</p>
      <section className="section">
        <div className="eyebrow">{t(loc, "adm.firms", { n: firms.length })}</div>
        <div className="list" style={{ marginTop: 16 }}>
          <div className={`it${cur === "demo" ? " on" : ""}`}>
            <div><div className="t">{t(loc, "adm.demoFirm")}</div><div className="m">{t(loc, "adm.demoFirmSub")}</div></div>
            <form action="/api/admin/firm" method="post"><input type="hidden" name="id" value="demo" /><button className="btn sec sm">{cur === "demo" ? "✓" : t(loc, "adm.open")}</button></form>
          </div>
          {firms.map((f) => (
            <div key={f.id} className={`it${cur === f.id ? " on" : ""}`}>
              <div style={{ minWidth: 0 }}><div className="t">{f.name}{f.cui ? ` · ${f.cui}` : ""}</div><div className="m">{t(loc, "adm.firmMeta", { trucks: f.trucks, users: f.users })} · {fmtDate(loc, f.createdAt.slice(0, 10), true)}{f.demoMode ? ` · ${t(loc, "firm.demoOn")}` : ""}</div></div>
              <form action="/api/admin/firm" method="post"><input type="hidden" name="id" value={f.id} /><button className="btn sec sm">{cur === f.id ? "✓" : t(loc, "adm.open")}</button></form>
            </div>
          ))}
          {!firms.length ? <div className="empty"><p>{t(loc, "adm.noFirms")}</p></div> : null}
        </div>
      </section>
      <section className="section">
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
    </main>
  );
}
