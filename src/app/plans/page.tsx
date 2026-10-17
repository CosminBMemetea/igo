import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { SHOWN_FEATURES as FEATURES, PLANS, PLAN_ORDER, planIncludes } from "@/lib/features";
import { t, tri } from "@/lib/i18n";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export default async function Plans(props: { searchParams: Promise<{ unit?: string }> }) {
  const searchParams = await props.searchParams;
  const { loc, plan } = (await getPrefs());
  const demoUser = (await getPrefs()).role === "user";
  const agri = !demoUser && searchParams.unit === "agri"; // fără prețuri deocamdată: doar oferta la cerere
  return (
    <main>
      <div style={{ textAlign: "center" }}>
        <div className="eyebrow fade">{t(loc, "nav.plans")}</div>
        <h1 className="h1 fade">{t(loc, "plans.title")}</h1>
        <p className="sub fade d1">{t(loc, "plans.sub")}</p>
        <a className="btn pri fade d2" style={{ marginTop: 28, display: "inline-flex" }} href="/support?topic=offer">{t(loc, "plans.quote")} →</a>
        <div className="seg fade d2" style={{ display: "none" }}>
          <Link href="/plans" className={agri ? "" : "on"} style={{ padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 500 }}>{t(loc, "plans.trucks")}</Link>
          <Link href="/plans?unit=agri" className={agri ? "on" : ""} style={{ padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 500 }}>{t(loc, "plans.agri")}</Link>
        </div>
      </div>
      <div className="plans">
        {PLAN_ORDER.map((p, i) => {
          const P = PLANS[p];
          const own = FEATURES.filter((f) => f.plan === p).length;
          return (
            <div key={p} className={`plan fade d${i + 1}${P.recommended ? " rec" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 22 }}>{P.name}</span>{P.recommended ? <span className="badge acc">{t(loc, "plans.recommended")}</span> : null}{plan === p ? <span className="badge ok">{t(loc, "plans.current")}</span> : null}</div>
              <div className="who sub" style={{ marginTop: 0 }}>{tri(loc, P.who)}</div>
              <ul>{P.top.map((x) => <li key={x}><Icon name="check" /><span>{tri(loc, x)}</span></li>)}</ul>
              <div className="sub" style={{ fontSize: 13 }}>{i ? t(loc, "plans.plus", { prev: PLANS[PLAN_ORDER[i - 1]].name, n: own }) : t(loc, "plans.base", { n: own })}</div>
              <a className={`btn ${P.recommended ? "pri" : "sec"}`} style={{ marginTop: "auto" }} href="/support?topic=offer">{t(loc, "plans.talk")}</a>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ textAlign: "center", marginTop: 20, fontSize: 12 }}>{t(loc, "plans.note")}</p>
      <div className="sheet fade" style={{ maxWidth: 560, margin: "28px auto 0", textAlign: "center" }}><p className="sub" style={{ marginTop: 0 }}>{t(loc, "plans.quoteSub")}</p><a className="btn pri" href="/support?topic=offer">{t(loc, "plans.quote")}</a></div>
      <section className="section">
        <div className="head"><h2>{t(loc, "plans.compare")}</h2></div>
        <div style={{ overflow: "auto" }}>
          <table className="mx">
            <thead><tr><th />{PLAN_ORDER.map((p) => <th key={p}>{PLANS[p].name}</th>)}</tr></thead>
            <tbody>
              {[...FEATURES].sort((a, b) => a.rank - b.rank).map((f) => (
                <tr key={f.id}><td>{tri(loc, f.name)}{f.planned ? <span className="badge" style={{ marginLeft: 6 }}>{t(loc, "feat.planned")}</span> : null}</td>{PLAN_ORDER.map((p) => <td key={p}>{planIncludes(p, f.id) ? <Icon name="check" /> : <span className="no">—</span>}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
