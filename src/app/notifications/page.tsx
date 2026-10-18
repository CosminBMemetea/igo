import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { notificationsFor } from "@/lib/notify";
import { fmtDate, t, tri, type MsgKey } from "@/lib/i18n";
import { STATUS_COLOR, docStatus } from "@/lib/docs";
import { todayFor } from "@/lib/today";

export const dynamic = "force-dynamic";
export default async function Notifications() {
  const { loc } = (await getPrefs());
  const tn = await tenant();
  const list = await notificationsFor(tn);
  const today = todayFor(tn.demo), unread = list.filter((n) => !n.readAt).length;
  return (
    <main className="setup">
      <div className="eyebrow fade">{t(loc, "ntf.title")}</div>
      <h1 className="h1 fade">{unread ? t(loc, "ntf.unread", { n: unread }) : t(loc, "ntf.allRead")}</h1>
      <p className="sub fade d1">{t(loc, "ntf.sub")}</p>
      {unread && !tn.demo ? <form action="/api/notifications/read" method="post" style={{ marginTop: 16 }}><button className="btn sec sm">{t(loc, "ntf.markAll")}</button></form> : null}
      <section className="section">
        {list.length ? (
          <div className="list">
            {list.map((n) => {
              if (n.kind === "compliance-task") return <Link key={n.id} href="/driver#tasks" className={`it ntf${n.readAt ? " read" : ""}`}><div><div className="t">{tri(loc, "Verificare solicitată|Check requested|Prośba o sprawdzenie")} · {String(n.params.label)}</div><div className="m">{n.params.type === "tollro" ? "TollRo" : n.params.type === "classification" ? tri(loc, "Date din talon|Registration details|Dane rejestracyjne") : t(loc, `doc.${n.params.type}` as MsgKey)} · {tri(loc, "Termen|Due|Termin")} {fmtDate(loc, String(n.params.expires), true)}</div></div></Link>;
              const p = n.params, doc = t(loc, `doc.${p.type}` as MsgKey), days = docStatus(String(p.expires), today).days;
              return (
                <Link key={n.id} href={tn.role === "driver" ? "/driver#docs" : "/documents"} className={`it ntf${n.readAt ? " read" : ""}`}>
                  <span className="dot" style={{ background: STATUS_COLOR[docStatus(String(p.expires), today).status] }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="t">{t(loc, days < 0 ? "ntf.expired" : days === 0 ? "ntf.today" : "ntf.soon", { doc, label: String(p.label), n: Math.abs(days) })}</div>
                    <div className="m">{t(loc, "docs.expires")} {fmtDate(loc, String(p.expires), true)} · {t(loc, `ntf.stage.${n.kind}` as MsgKey)} · {fmtDate(loc, n.createdAt.slice(0, 10), true)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : <p className="sub">{t(loc, "ntf.none")}</p>}
      </section>
    </main>
  );
}
