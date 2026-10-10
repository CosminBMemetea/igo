import Link from "next/link";
import { FEATURES, PLANS, planIncludes, type FeatureId } from "@/lib/features";
import { t, tri } from "@/lib/i18n";
import type { Prefs } from "@/lib/prefs";
import { Icon } from "./icons";

/** Funcție blocată: conținutul se vede încețoșat (previzualizare), cu „Deblochează cu …”. */
export function Gate({ feature, prefs, children, inline }: { feature: FeatureId; prefs: Prefs; children: React.ReactNode; inline?: boolean }) {
  if (planIncludes(prefs.plan, feature)) return <>{children}</>;
  const f = FEATURES.find((x) => x.id === feature)!;
  const name = PLANS[f.plan].name;
  if (inline) return (
    <Link href="/plans" className="ask fade d2" style={{ textDecoration: "none", color: "var(--fg2)", padding: "14px 24px" }}>
      <span className="lk" style={{ width: 32, height: 32, margin: 0 }}><Icon name="lock" /></span>
      <span style={{ flex: 1 }}>{tri(prefs.loc, f.name)} · <span className="acc">{t(prefs.loc, "lock.unlock", { plan: name })}</span></span>
    </Link>
  );
  return (
    <>
      <div className="locked-prev" aria-hidden>{children}</div>
      <div className="lock">
        <div className="lockcard fade">
          <span className="lk"><Icon name="lock" /></span>
          <div className="eyebrow">{name}</div>
          <h3>{tri(prefs.loc, f.name)}</h3>
          <p className="sub">{tri(prefs.loc, f.desc)}</p>
          <Link className="btn pri" href={`/plans`}>{t(prefs.loc, "lock.unlock", { plan: name })}</Link>
          <Link className="link" href="/features" style={{ display: "block", marginTop: 14 }}>{t(prefs.loc, "lock.all")}</Link>
        </div>
      </div>
    </>
  );
}
