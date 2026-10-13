import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { t, type MsgKey } from "@/lib/i18n";
import { RULES } from "@/lib/fleet/rules";
import { FIRM_RULES } from "@/lib/fuel/rules";
import { Gate } from "@/components/Gate";
import { AlertList } from "../AlertList";
import { demoResolved } from "@/lib/demo-shift";
import { FT } from "@/lib/feed-i18n";

export const dynamic = "force-dynamic";
export default async function Alerts() {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  if (!d.demo && !d.alerts.length) return <main><EmptyState kind="alerts" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const rules = d.demo ? [...RULES, "loss", "doc-expiry"] : [...FIRM_RULES, "loss", "doc-expiry"];
  return (
    <Gate feature="alertsCenter" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "alerts.title")}</div>
        <div className="big fade" style={{ marginTop: 8 }}>{d.alerts.length}</div>
        <p className="sub fade d1" dangerouslySetInnerHTML={{ __html: t(loc, "alerts.sub", { n: d.alerts.length, theft: d.alerts.filter((a) => a.theft).length }) }} />
        {d.demo ? (() => { const rs = demoResolved(), n = d.alerts.filter((a) => (a.theft || a.rule === "doc-expiry") && !rs[(a.theft ? "t-" : "c-") + a.id]).length; return <div className={`fsec${n ? "" : " ok"}`} style={{ marginTop: 18 }}>{n ? <>{FT[loc].attn}<span className="fcnt">{n}</span></> : <>✓ {FT[loc].attnNone}</>}</div>; })() : null}
        <section className="section"><AlertList alerts={d.alerts} vehicles={d.vehicles} loc={loc} res={d.demo ? demoResolved() : undefined} F={FT[loc]} /></section>
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
