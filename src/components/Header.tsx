import Link from "next/link";
import { t, tri, LOCALES } from "@/lib/i18n";
import type { Prefs } from "@/lib/prefs";
import { PLANS } from "@/lib/features";
import { Icon } from "./icons";
import { NavIcons } from "./NavIcons";

export function Header({ prefs }: { prefs: Prefs }) {
  const { loc, theme, plan, trialLeft } = prefs;
  return (
    <>
      <header className="top">
        <Link href="/" className="logo">igo<small>by Querra</small></Link>
        <NavIcons labels={{ home: t(loc, "nav.home"), live: t(loc, "nav.live"), trips: t(loc, "nav.trips"), alerts: t(loc, "nav.alerts"), crm: t(loc, "nav.crm"), docs: t(loc, "nav.docs"), receipts: t(loc, "nav.receipts"), invoices: t(loc, "nav.invoices"), driver: t(loc, "nav.driver"), features: t(loc, "nav.features") }} />
        <div className="prefs">
          {LOCALES.map((l) => <a key={l} className={`lang${l === loc ? " on" : ""}`} href={`?lang=${l}`} aria-label={`${t(loc, "pref.lang")}: ${l}`}>{l.toUpperCase()}</a>)}
          <a className="ico" href={`?theme=${theme === "dark" ? "light" : "dark"}`} aria-label={t(loc, "pref.theme")}><Icon name={theme === "dark" ? "sun" : "moon"} /></a>
        </div>
      </header>
      {plan === "trial" ? (
        <Link href="/plans" className="trial">
          <span className="ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" stroke="var(--bg3)" /><circle cx="18" cy="18" r="15" stroke="var(--acc)" strokeDasharray="94.2" strokeDashoffset={94.2 * (1 - trialLeft / 14)} /></svg><b>{trialLeft}</b></span>
          <span>{t(loc, "trial.banner", { n: trialLeft })}</span><span className="go">{t(loc, "trial.choose")}</span>
        </Link>
      ) : null}
      <div className="demo"><i></i><span>{t(loc, "app.demo")}{plan !== "trial" ? ` · ${tri(loc, "Plan|Plan|Plan")} ${PLANS[plan].name}` : ""}</span></div>
    </>
  );
}
