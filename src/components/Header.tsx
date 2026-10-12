import Link from "next/link";
import { t, LOCALES } from "@/lib/i18n";
import type { Prefs } from "@/lib/prefs";
import { PLANS } from "@/lib/features";
import { Icon } from "./icons";
import { NavIcons } from "./NavIcons";
import { TourButton } from "./DemoTour";
import { Logo } from "./Logo";
import { ROLE_LOOK, RoleIcon, lookOf } from "@/lib/roles";

export interface FirmCtx { name: string | null; demo: boolean; demoMode: boolean; canToggle: boolean; dbOk: boolean; unread: number; blobOk: boolean; who?: string | null; plate?: string | null; path?: string; denied?: string | null }
export function Header({ prefs, firm }: { prefs: Prefs; firm: FirmCtx }) {
  const { loc, theme, plan, trialLeft, role, adminView, previewPlan, view } = prefs;
  const look = lookOf(role);
  const ctxText = look === "owner" ? (firm.demo ? t(loc, "rl.demoFirm") : firm.name) : look === "driver" ? [firm.who ?? prefs.email, firm.plate].filter(Boolean).join(" · ") : null;
  const badge = look ? (
    <span className={`rbadge r-${look}`} title={t(loc, ROLE_LOOK[look].label)}>
      <RoleIcon k={look} /><b>{t(loc, ROLE_LOOK[look].label)}</b>{ctxText ? <em>{ctxText}</em> : null}{firm.demo && look !== "admin" ? <i className="rdemo">DEMO</i> : null}
    </span>
  ) : null;
  const onAdmin = role === "admin" && (firm.path ?? "").startsWith("/admin");
  const notices = (
    <>
      {role === "admin" && !onAdmin ? <div className="rolebar r-admin"><RoleIcon k="admin" /><span>{t(loc, "rl.adminViewing", { firm: firm.demo ? t(loc, "rl.demoFirm") : firm.name ?? "—" })}</span><Link href="/admin">{t(loc, "rl.exit")}</Link></div> : null}
      {firm.denied ? <div className="rolebar r-deny"><span>{t(loc, "rl.denied", { role: look ? t(loc, ROLE_LOOK[look].label) : "" })}</span></div> : null}
    </>
  );
  const prefsBox = (
    <div className="prefs">
      {firm.demo && role === "user" ? <TourButton label={t(loc, "tour.btn")} /> : null}
      {LOCALES.map((l) => <a key={l} className={`lang${l === loc ? " on" : ""}`} href={`?lang=${l}`} aria-label={`${t(loc, "pref.lang")}: ${l}`}>{l.toUpperCase()}</a>)}
      <a className="ico" href={`?theme=${theme === "dark" ? "light" : "dark"}`} aria-label={t(loc, "pref.theme")}><Icon name={theme === "dark" ? "sun" : "moon"} /></a>
      {role ? <Link className="ico bell" href="/notifications" aria-label={t(loc, "ntf.title")}><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0" /></svg>{firm.unread ? <b>{firm.unread > 9 ? "9+" : firm.unread}</b> : null}</Link> : null}
      {role ? (
        <details className="acct">
          <summary className="ico" aria-label={t(loc, "acct.menu")}>{badge}</summary>
          <div className="menu">
            <div className="who">{prefs.email}{firm.name ? <><br /><span className="firmtag">{firm.name}</span></> : null}</div>
            {firm.canToggle ? (
              <form action="/api/firm/demo" method="post" className="demoTgl">
                <input type="hidden" name="on" value={firm.demoMode ? "0" : "1"} />
                <div><div style={{ fontSize: 14 }}>{t(loc, "firm.demoData")}</div><p className="hint" style={{ margin: "2px 0 0" }}>{firm.demoMode ? t(loc, "firm.demoOnHint") : t(loc, "firm.demoOffHint")}</p></div>
                <button className={`switch${firm.demoMode ? " on" : ""}`} role="switch" aria-checked={firm.demoMode} aria-label={t(loc, "firm.demoData")} />
              </form>
            ) : null}
            {role === "owner" || role === "admin" ? <Link className="btn sec sm" href={role === "admin" ? "/admin" : "/setup"}>{role === "admin" ? t(loc, "adm.title") : t(loc, "set.title")}</Link> : null}
            {role === "owner" || (role === "admin" && !firm.demo) ? <Link className="btn sec sm" href="/import">{t(loc, "imp.title")}</Link> : null}
            {role !== "admin" ? <Link className="btn sec sm" href="/support">{t(loc, "sup.title")}</Link> : null}
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
  const dbBar = role === "admin" && !firm.dbOk ? <div className="dbbar" role="status">{t(loc, "db.missing")}</div> : null;
  // fără sesiune (login/înscriere/invitație): pagina are deja logo-ul mare → antetul arată doar limba și tema
  if (!role) return <><header className="top"><span />{prefsBox}</header>{dbBar}</>;
  if (role === "driver") return <><header className="top"><span className="logo"><Logo /></span>{prefsBox}</header>{dbBar}{notices}</>;
  return (
    <>
      <header className="top">
        <Link href="/" className="logo" aria-label="Querra Fleet"><Logo /></Link>
        {onAdmin ? <nav className="adnav">{(["firms", "support", "emails", "test-email"] as const).map((k) => <a key={k} href={`/admin#${k}`}>{t(loc, `rl.nav.${k}`)}</a>)}<Link href="/">{t(loc, "rl.nav.app")}</Link></nav> : <NavIcons demo={firm.demo} labels={{ import: t(loc, "nav.import"), savings: t(loc, "nav.savings"),  home: t(loc, "nav.home"), live: t(loc, "nav.live"), trips: t(loc, "nav.trips"), alerts: t(loc, "nav.alerts"), crm: t(loc, "nav.crm"), docs: t(loc, "nav.docs"), receipts: t(loc, "nav.receipts"), invoices: t(loc, "nav.invoices"), driver: t(loc, "nav.driver"), features: t(loc, "nav.features") }} />}
        {prefsBox}
      </header>
      {plan === "trial" && !adminView ? (
        <Link href="/plans" className="trial">
          <span className="ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" stroke="var(--bg3)" /><circle cx="18" cy="18" r="15" stroke="var(--acc)" strokeDasharray="94.2" strokeDashoffset={94.2 * (1 - trialLeft / 14)} /></svg><b>{trialLeft}</b></span>
          <span>{t(loc, "trial.banner", { n: trialLeft })}</span><span className="go">{t(loc, "trial.choose")}</span>
        </Link>
      ) : null}
      {dbBar}
      {notices}
      {firm.demo && !onAdmin ? <div className="demo"><i></i><span>{t(loc, "app.demo")}{role === "admin" ? ` · ${adminView ? t(loc, "acct.adminAll") : t(loc, "acct.asUser", { plan: plan === "trial" ? t(loc, "feat.trial") : PLANS[plan].name })}` : plan !== "trial" ? ` · ${PLANS[plan].name}` : ""}</span></div> : null}
    </>
  );
}
