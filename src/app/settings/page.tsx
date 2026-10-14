import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { t, type MsgKey } from "@/lib/i18n";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
export const dynamic = "force-dynamic";
/** Cont și firmă: un singur loc pentru date firmă, camioane, șoferi, parolă, date personale (GDPR). */
export default async function Settings() {
  const { loc } = getPrefs(), tn = await tenant();
  if (tn.role === "driver") redirect("/driver");
  const me = tn.uid ? await store().userById(tn.uid).catch(() => null) : null;
  const rows: [MsgKey, MsgKey, string][] = [["stg.firm", "stg.firmSub", "/setup?step=1"], ["stg.trucks", "stg.trucksSub", "/setup?step=2"], ["stg.drivers", "stg.driversSub", "/setup?step=3"], ["stg.docs", "stg.docsSub", "/documents"]];
  return (
    <main className="stg">
      <div className="eyebrow fade">{t(loc, "stg.eyebrow")}</div>
      <h1 className="h1 fade">{t(loc, "stg.title")}</h1>
      <p className="sub fade d1">{tn.firm?.name ?? ""}{me?.email ? ` · ${me.email}` : ""}</p>
      <div className="list fade d1" style={{ marginTop: 20 }}>
        {rows.map(([a, b, h]) => <Link key={h} href={h} className="it"><div style={{ minWidth: 0 }}><div className="t">{t(loc, a)}</div><div className="m">{t(loc, b)}</div></div><span aria-hidden>→</span></Link>)}
      </div>
      {me?.email ? (
        <section className="section fade d2"><div className="head"><h2>{t(loc, "stg.pw")}</h2></div>
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
