import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { FEATURES, PLANS, PLAN_ORDER, planIncludes } from "@/lib/features";
import { fmtNum, t, tri } from "@/lib/i18n";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export default function Plans({ searchParams }: { searchParams: { unit?: string } }) {
  const { loc, plan } = getPrefs();
  const demoUser = getPrefs().role === "user";
  const agri = !demoUser && searchParams.unit === "agri";
  return (
    <main>
      <div style={{ textAlign: "center" }}>
        <div className="eyebrow fade">{t(loc, "nav.plans")}</div>
        <h1 className="h1 fade">{t(loc, "plans.title")}</h1>
        <p className="sub fade d1">{t(loc, "plans.sub")}</p>
        <div className="seg fade d2" style={{ margin: "28px auto 0", display: demoUser ? "none" : undefined }}>
          <Link href="/plans" className={agri ? "" : "on"} style={{ padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 500 }}>{t(loc, "plans.trucks")}</Link>
          <Link href="/plans?unit=agri" className={agri ? "on" : ""} style={{ padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 500 }}>{t(loc, "plans.agri")}</Link>
        </div>
      </div>
      <div className="plans">
        {PLAN_ORDER.map((p, i) => {
          const P = PLANS[p], price = agri ? P.eurPerMachineSeason : P.eurPerVehicleMonth;
          const own = FEATURES.filter((f) => f.plan === p).length;
          return (
            <div key={p} className={`plan fade d${i + 1}${P.recommended ? " rec" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 22 }}>{P.name}</span>{P.recommended ? <span className="badge acc">{t(loc, "plans.recommended")}</span> : null}{plan === p ? <span className="badge ok">{t(loc, "plans.current")}</span> : null}</div>
              <div className="who sub" style={{ marginTop: 0 }}>{tri(loc, P.who)}</div>
              <div className="price">{fmtNum(loc, price)} €<small>{agri ? t(loc, "plans.perMachine") : t(loc, "plans.perVehicle")}</small></div>
              <ul>{P.top.map((x) => <li key={x}><Icon name="check" /><span>{tri(loc, x)}</span></li>)}</ul>
              <div className="sub" style={{ fontSize: 13 }}>{i ? t(loc, "plans.plus", { prev: PLANS[PLAN_ORDER[i - 1]].name, n: own }) : t(loc, "plans.base", { n: own })}</div>
              <a className={`btn ${P.recommended ? "pri" : "sec"}`} style={{ marginTop: "auto" }} href="/features">{plan === "trial" ? t(loc, "plans.start") : t(loc, "plans.choose", { plan: P.name })}</a>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ textAlign: "center", marginTop: 20, fontSize: 12 }}>{t(loc, "plans.note")}</p>
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
