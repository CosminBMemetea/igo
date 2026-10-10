import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { CATS, FEATURES, PLANS, planIncludes, type FeatureId } from "@/lib/features";
import { t, tri } from "@/lib/i18n";
import { Icon } from "@/components/icons";

const LINK: Partial<Record<FeatureId, string>> = { profit: "/trips", savings: "/", live: "/live", receipts: "/receipts", documents: "/documents", driverApp: "/driver", crm: "/crm", invoicing: "/invoices", replay: "/live", maintenance: "/documents?tab=service", agri: "/vehicles/lexion760", ai: "/", alertsCenter: "/alerts", fuelAlerts: "/alerts", efactura: "/invoices" };
export const dynamic = "force-dynamic";
export default function Features() {
  const { loc, plan, trialLeft } = getPrefs();
  const on = FEATURES.filter((f) => planIncludes(plan, f.id)).length;
  return (
    <main>
      <div className="eyebrow fade">{t(loc, "nav.features")}</div>
      <h1 className="h1 fade">{plan === "trial" ? t(loc, "feat.title.trial", { n: FEATURES.length }) : t(loc, "feat.title.plan", { on, n: FEATURES.length, plan: PLANS[plan].name })}</h1>
      <p className="sub fade d1">{plan === "trial" ? t(loc, "feat.lead.trial", { d: trialLeft }) : t(loc, "feat.lead.plan")}</p>
      <div className="seg fade d2" style={{ marginTop: 32 }}>
        {(["trial", "start", "pro", "business"] as const).map((p) => <a key={p} href={`/features?plan=${p}`} className={p === plan ? "on" : ""} style={{ padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 500 }}>{p === "trial" ? t(loc, "feat.trial") : PLANS[p].name}</a>)}
      </div>
      {(Object.keys(CATS) as (keyof typeof CATS)[]).map((c) => (
        <section key={c} className="section" style={{ marginTop: 56 }}>
          <div className="head"><h2>{tri(loc, CATS[c])}</h2></div>
          <div className="tiles">
            {FEATURES.filter((f) => f.cat === c).sort((a, b) => a.rank - b.rank).map((f) => {
              const ok = planIncludes(plan, f.id);
              const badge = f.planned ? <span className="badge">{t(loc, "feat.planned")}</span> : ok ? (plan === "trial" && f.plan !== "start" ? <span className="badge acc">{t(loc, "feat.inTrial")}</span> : <span className="badge ok"><Icon name="check" />{t(loc, "feat.included")}</span>) : <span className="badge"><Icon name="lock" />{PLANS[f.plan].name}</span>;
              return (
                <Link key={f.id} className={`tile fade${ok ? "" : " off"}`} href={ok ? LINK[f.id] ?? "/features" : "/plans"}>
                  {badge}
                  <span style={{ fontSize: 11, color: "var(--fg3)", letterSpacing: ".1em" }}>#{f.rank}</span>
                  <div className="t" style={{ marginTop: 22 }}>{tri(loc, f.name)}</div>
                  <div className="d">{tri(loc, f.desc)}</div>
                  {!ok ? <div className="acc" style={{ fontSize: 13, marginTop: "auto" }}>{t(loc, "lock.unlock", { plan: PLANS[f.plan].name })} →</div> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
