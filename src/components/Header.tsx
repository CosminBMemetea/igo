import Link from "next/link";
import { t, LOCALES } from "@/lib/i18n";
import type { Prefs } from "@/lib/prefs";
import { PLANS } from "@/lib/features";
import { Icon } from "./icons";
import { NavIcons } from "./NavIcons";

export function Header({ prefs }: { prefs: Prefs }) {
  const { loc, theme, plan, trialLeft, role, adminView, previewPlan, view } = prefs;
  const prefsBox = (
    <div className="prefs">
      {LOCALES.map((l) => <a key={l} className={`lang${l === loc ? " on" : ""}`} href={`?lang=${l}`} aria-label={`${t(loc, "pref.lang")}: ${l}`}>{l.toUpperCase()}</a>)}
      <a className="ico" href={`?theme=${theme === "dark" ? "light" : "dark"}`} aria-label={t(loc, "pref.theme")}><Icon name={theme === "dark" ? "sun" : "moon"} /></a>
      {role ? (
        <details className="acct">
          <summary className="ico" aria-label={t(loc, "acct.menu")}><span className={`rbadge${role === "admin" ? " adm" : ""}`}>{role === "admin" ? t(loc, "acct.admin") : t(loc, "acct.user")}</span></summary>
          <div className="menu">
            <div className="who">{prefs.email}</div>
            {role === "admin" ? (
              <>
                <div className="eyebrow">{t(loc, "acct.mode")}</div>
                <div className="seg">
                  <a href="?view=admin" className={view === "admin" ? "on" : ""}>{t(loc, "acct.modeAdmin")}</a>
                  <a href="?view=user" className={view === "user" ? "on" : ""}>{t(loc, "acct.modeUser")}</a>
                </div>
                <div className="eyebrow">{t(loc, "acct.preview")}</div>
                <div className="seg">
                  {(["trial", "start", "pro", "business"] as const).map((p) => <a key={p} href={`?plan=${p}&view=user`} className={view === "user" && previewPlan === p ? "on" : ""}>{p === "trial" ? t(loc, "feat.trial") : PLANS[p].name}</a>)}
                </div>
                <p className="hint">{t(loc, "acct.previewHint")}</p>
              </>
            ) : null}
            <form action="/api/auth/logout" method="post"><button className="btn sec" style={{ width: "100%" }}>{t(loc, "acct.logout")}</button></form>
          </div>
        </details>
      ) : null}
    </div>
  );
  if (!role) return <header className="top"><span className="logo">igo<small>by Querra</small></span>{prefsBox}</header>;
  return (
    <>
      <header className="top">
        <Link href="/" className="logo">igo<small>by Querra</small></Link>
        <NavIcons labels={{ home: t(loc, "nav.home"), live: t(loc, "nav.live"), trips: t(loc, "nav.trips"), alerts: t(loc, "nav.alerts"), crm: t(loc, "nav.crm"), docs: t(loc, "nav.docs"), receipts: t(loc, "nav.receipts"), invoices: t(loc, "nav.invoices"), driver: t(loc, "nav.driver"), features: t(loc, "nav.features") }} />
        {prefsBox}
      </header>
      {plan === "trial" && !adminView ? (
        <Link href="/plans" className="trial">
          <span className="ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" stroke="var(--bg3)" /><circle cx="18" cy="18" r="15" stroke="var(--acc)" strokeDasharray="94.2" strokeDashoffset={94.2 * (1 - trialLeft / 14)} /></svg><b>{trialLeft}</b></span>
          <span>{t(loc, "trial.banner", { n: trialLeft })}</span><span className="go">{t(loc, "trial.choose")}</span>
        </Link>
      ) : null}
      <div className="demo"><i></i><span>{t(loc, "app.demo")}{role === "admin" ? ` · ${adminView ? t(loc, "acct.adminAll") : t(loc, "acct.asUser", { plan: plan === "trial" ? t(loc, "feat.trial") : PLANS[plan].name })}` : plan !== "trial" ? ` · ${PLANS[plan].name}` : ""}</span></div>
    </>
  );
}
