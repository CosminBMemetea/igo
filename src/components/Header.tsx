import Link from "next/link";
import { DenyToast } from "./DenyToast";
import { t } from "@/lib/i18n";
import type { Prefs } from "@/lib/prefs";
import { PLANS } from "@/lib/features";
import { LT } from "@/lib/lead-i18n";
import { BtnSize } from "./BtnSize";
import { Icon } from "./icons";
import { NavIcons } from "./NavIcons";
import { TourButton } from "./DemoTour";
import { LangPicker } from "./LangPicker";
import { MenuCloser } from "./MenuCloser";
import { Suspense } from "react";
import { Logo } from "./Logo";
import { PageTitle } from "./PageTitle";
import { ROLE_LOOK, RoleIcon, lookOf } from "@/lib/roles";

export interface FirmCtx { name: string | null; demo: boolean; demoMode: boolean; canToggle: boolean; dbOk: boolean; unread: number; alerts?: number; blobOk: boolean; who?: string | null; plate?: string | null; path?: string; denied?: string | null }
export function Header({ prefs, firm }: { prefs: Prefs; firm: FirmCtx }) {
  const { loc, theme, plan, trialLeft, role, adminView, previewPlan, view } = prefs;
  const look = lookOf(role);
  const ctxText = look === "owner" ? (firm.demo ? t(loc, "rl.demoFirm") : firm.name) : look === "driver" ? [firm.who ?? prefs.email, firm.plate].filter(Boolean).join(" · ") : null;
  const badge = look ? (
    <span className={`rbadge r-${look}`} title={t(loc, ROLE_LOOK[look].label)}>
      <RoleIcon k={look} /><b>{t(loc, ROLE_LOOK[look].label)}</b>{ctxText ? <em>{ctxText}</em> : null}{firm.demo && look !== "admin" ? <i className="rdemo">DEMO</i> : null}
    </span>
  ) : null;
  const seg = "/" + ((firm.path ?? "/").split("/")[1] ?? "");
  const PT: Record<string, Parameters<typeof t>[1]> = { "/": "nav.home", "/live": "nav.live", "/trips": "nav.trips", "/replay": "nav.trips", "/vehicles": "kind.truck", "/alerts": "nav.alerts", "/documents": "nav.docs", "/import": "nav.import", "/driver": "nav.driver", "/savings": "nav.savings", "/settings": "stg.title", "/ranking": "nav.ranking", "/feed": "nav.feed", "/crm": "nav.crm", "/receipts": "nav.receipts", "/invoices": "nav.invoices", "/features": "nav.features", "/notifications": "ntf.title", "/support": "sup.title", "/setup": "set.title", "/admin": "adm.title" };
  const ptitle = <PageTitle titles={Object.fromEntries(Object.entries(PT).map(([k, v]) => [k, t(loc, v)]))} />; void seg;
  const onAdmin = role === "admin" && (firm.path ?? "").startsWith("/admin");
  const notices = (
    <>
      {role === "admin" && !onAdmin ? <div className="rolebar r-admin"><RoleIcon k="admin" /><span>{t(loc, "rl.adminViewing", { firm: firm.demo ? t(loc, "rl.demoFirm") : firm.name ?? "—" })}</span><Link href="/admin">{t(loc, "rl.exit")}</Link></div> : null}
      {firm.denied ? <DenyToast text={t(loc, "rl.denied", { role: look ? t(loc, ROLE_LOOK[look].label) : "" })} close={t(loc, "rl.close")} /> : null}
    </>
  );
  const prefsBox = (
    <div className="prefs">
      {firm.demo && role === "user" ? <span className="dsk"><TourButton label={t(loc, "tour.btn")} /></span> : null}
      <a className={`ico${role ? " dsk" : ""}`} href={`?theme=${theme === "dark" ? "light" : "dark"}`} aria-label={t(loc, "pref.theme")}><Icon name={theme === "dark" ? "sun" : "moon"} /></a>
      {role ? <Link className="ico bell dsk" href="/notifications" aria-label={t(loc, "ntf.title")}><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0" /></svg>{firm.unread ? <b>{firm.unread > 9 ? "9+" : firm.unread}</b> : null}</Link> : null}
      {role ? (
        <details className="acct">
          <Suspense fallback={null}><MenuCloser /></Suspense>
          <summary className="ico" aria-label={t(loc, "acct.menu")}>{badge}<span className={`mdot r-${look ?? "owner"}`}>{firm.unread ? <b /> : null}</span><svg className="mburg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16" /></svg></summary>
          <div className="menu">
            <BtnSize label={t(loc, "pref.bsize")} opts={["L", "XL", "XXL"]} />
            <div className="monly">
              <div className="mhead">{badge}</div>
              {plan === "trial" && !adminView && !firm.demo ? <Link href="/plans" className="mrow"><span>{t(loc, "trial.banner", { n: trialLeft })}</span><b>{t(loc, "trial.choose")}</b></Link> : null}
              {firm.demo && role === "user" ? <TourButton label={t(loc, "tour.btn")} /> : null}
              <Link href="/notifications" className="mrow"><span>{t(loc, "ntf.title")}</span>{firm.unread ? <b className="cnt">{firm.unread > 9 ? "9+" : firm.unread}</b> : null}</Link>
              {(role === "owner" || role === "admin") && !firm.demo ? <Link href="/settings" className="mrow"><span>{t(loc, "stg.title")}</span></Link> : null}
              <a href={`?theme=${theme === "dark" ? "light" : "dark"}`} className="mrow"><span>{t(loc, "pref.theme")}</span><Icon name={theme === "dark" ? "sun" : "moon"} /></a>
            </div>
            <Suspense fallback={null}><LangPicker loc={loc} title={t(loc, "pref.lang")} inline persist /></Suspense>
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
            {role === "owner" || role === "user" ? <Link className="btn sec sm" href="/recomanda">🎁 {LT[loc].refNav}</Link> : null}
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
            {firm.demo && !firm.name && (role === "user" || role === "driver") ? (
              <form action="/api/auth/demo" method="post" style={{ marginBottom: 8 }}><input type="hidden" name="as" value={role === "driver" ? "owner" : "driver"} /><input type="hidden" name="keep" value="1" /><button className="btn sec sm" style={{ width: "100%" }}>{t(loc, role === "driver" ? "acct.asOwner" : "acct.asDriver")}</button></form>
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
  if (role === "driver") return <><header className="top"><span className="logo"><Logo /></span>{ptitle}{prefsBox}</header>{dbBar}{notices}</>;
  return (
    <>
      <header className="top">
        <Link href={role === "admin" ? "/admin" : firm.demo ? "/feed" : "/"} className="logo" aria-label="Querra Fleet"><Logo /></Link>
        {ptitle}
        {onAdmin ? <nav className="adnav">{(["firms", "support", "emails", "test-email"] as const).map((k) => <a key={k} href={`/admin#${k}`}>{t(loc, `rl.nav.${k}`)}</a>)}<Link href="/">{t(loc, "rl.nav.app")}</Link></nav> : <NavIcons demo={firm.demo} driver={lookOf(role) === "driver"} alerts={firm.alerts ?? 0} tour={firm.demo && role === "user" ? t(loc, "tour.chip") : undefined} labels={{ more: t(loc, "nav.more"), close: t(loc, "rl.close"), notif: t(loc, "ntf.title"), settings: t(loc, "stg.title"), import: t(loc, "nav.import"), savings: t(loc, "nav.savings"), ranking: t(loc, "nav.ranking"), feed: t(loc, "nav.feed"),  home: t(loc, "nav.home"), live: t(loc, "nav.live"), trips: t(loc, "nav.trips"), alerts: t(loc, "nav.alerts"), crm: t(loc, "nav.crm"), docs: t(loc, "nav.docs"), receipts: t(loc, "nav.receipts"), invoices: t(loc, "nav.invoices"), driver: t(loc, "nav.driver"), features: t(loc, "nav.features") }} />}
        {prefsBox}
      </header>
      {plan === "trial" && !adminView && !firm.demo ? (
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
