import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { t, type MsgKey } from "@/lib/i18n";
import { RULES } from "@/lib/fleet/rules";
import { Gate } from "@/components/Gate";
import { AlertList } from "../AlertList";

export const dynamic = "force-dynamic";
export default async function Alerts() {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  if (!d.demo && !d.alerts.length) return <main><EmptyState kind="alerts" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const rules = [...RULES, "loss", "agri-over", "doc-expiry"];
  return (
    <Gate feature="alertsCenter" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "alerts.title")}</div>
        <div className="big fade" style={{ marginTop: 8 }}>{d.alerts.length}</div>
        <p className="sub fade d1" dangerouslySetInnerHTML={{ __html: t(loc, "alerts.sub", { n: d.alerts.length, theft: d.alerts.filter((a) => a.theft).length }) }} />
        <section className="section"><AlertList alerts={d.alerts} vehicles={d.vehicles} loc={loc} /></section>
        <section className="section">
          <div className="head"><h2>{t(loc, "alerts.rules")}</h2></div>
          <div className="cards">
            {rules.map((r) => <div className="card" key={r}><div className="k">{t(loc, `rule.${r}` as MsgKey)}</div><div className="d" style={{ marginTop: 10 }}>{t(loc, `ruledesc.${r}` as MsgKey)}</div></div>)}
          </div>
        </section>
      </main>
    </Gate>
  );
}
