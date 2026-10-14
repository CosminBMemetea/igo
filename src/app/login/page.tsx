import Link from "next/link";
import { cookies } from "next/headers";
import { DEMO_SID } from "@/lib/demo-shift";
import { getPrefs } from "@/lib/prefs";
import { t, type MsgKey } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { LT } from "@/lib/lead-i18n";
import { ROLE_LOOK, RoleIcon, type RoleLook } from "@/lib/roles";

export const dynamic = "force-dynamic";
const ERR: Record<string, MsgKey> = { bad: "acct.bad", badpin: "acct.badPin", locked: "acct.locked", off: "acct.off", disabled: "acct.disabled", nosecret: "acct.nosecret" };
export default function Login({ searchParams }: { searchParams: { e?: string; as?: string; next?: string; m?: string; ok?: string } }) {
  const { loc } = getPrefs();
  const secret = (process.env.SESSION_SECRET?.length ?? 0) >= 32, hasDemo = !!cookies().get(DEMO_SID)?.value;
  const err = searchParams.e && ERR[searchParams.e];
  // ?next= se păstrează prin formulare; serverul îl validează (cale relativă, permisă rolului)
  const next = typeof searchParams.next === "string" && /^\/(?![/\\])/.test(searchParams.next) ? searchParams.next.slice(0, 200) : "";
  const nx = next ? <input type="hidden" name="next" value={next} /> : null;
  const as: RoleLook = searchParams.as === "driver" ? "driver" : searchParams.as === "admin" ? "admin" : "owner";
  const tab = (k: RoleLook) => (
    <Link key={k} href={`/login?as=${k}${next ? `&next=${encodeURIComponent(next)}` : ""}`} className={`rtab r-${k}${as === k ? " on" : ""}`} aria-current={as === k ? "page" : undefined}>
      <RoleIcon k={k} /><b>{t(loc, ROLE_LOOK[k].label)}</b><span>{t(loc, `rl.${k}.hint` as MsgKey)}</span>
    </Link>
  );
  return (
    <main className={`login r-${as}`}>
      <div className="fade" style={{ color: "var(--fg)", marginBottom: 18 }}><Logo height={44} /></div>
      {as !== "admin" ? (
        <>
          <h1 className="h1 fade lhero">{t(loc, "login.hero")}</h1>
          <p className="sub fade d1 lsub">{t(loc, "login.heroSub")}</p>
          <form action="/api/auth/demo" method="post" className="fade d1 ldemo">
            {nx}
            <button className="btn pri xl" style={{ width: "100%" }} disabled={!secret}>{t(loc, "login.demo")} →</button>
            <p className="hint" style={{ textAlign: "center", marginTop: 10 }}>{secret ? <><b className="nocard">{t(loc, "login.noCard")}</b> · {t(loc, "acct.demoHint")}</> : t(loc, "acct.nosecret")}</p>
          </form>
          <form action="/api/auth/demo" method="post" className="fade d1 ldemo" style={{ marginTop: 6 }}>
            <input type="hidden" name="as" value="driver" />{nx}
            <button className="btn sec ldrv" style={{ width: "100%" }} disabled={!secret}>🚚 {t(loc, "login.demoDriver")} →</button>
          </form>
          {hasDemo ? (
            <form action="/api/auth/demo" method="post" className="fade d1 ldemo lreset" style={{ marginTop: 10, textAlign: "center" }}>
              <input type="hidden" name="reset" value="1" />
              <button className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 14 }} disabled={!secret}>↺ {t(loc, "login.demoReset")}</button>
              <p className="hint" style={{ marginTop: 4 }}>{t(loc, "login.demoResetHint")}</p>
            </form>
          ) : null}

          <Link href="/incearca" className="btn sec ltry fade d1" style={{ width: "100%", marginTop: 10 }}>🎁 {LT[loc].loginLink}</Link>
          <div className="or">{t(loc, "login.or")}</div>
          <div className="rtabs fade d2">{tab("owner")}{tab("driver")}</div>
        </>
      ) : <><h1 className="h1 fade">{t(loc, "rl.admin.title")}</h1><p className="sub fade d1">{t(loc, "rl.admin.sub")}</p></>}
      {searchParams.ok === "reset" ? <p className="msg ok" role="status">{t(loc, "login.resetOk")}</p> : null}
      {err ? <p className="msg err" role="alert">{t(loc, err).replace("{m}", String(Math.min(999, Number(searchParams.m) || 15)))}</p> : null}
      {secret ? (
        <form className={`sheet fade d1 rform r-${as}`} action="/api/auth/login" method="post">
          {nx}<input type="hidden" name="as" value={as} />
          {as === "driver" ? (
            <>
              <label className="lf big"><span>{t(loc, "rl.phone")}</span><input name="email" type="tel" inputMode="tel" autoComplete="tel" placeholder="07xx xxx xxx" required /></label>
              <label className="lf big"><span>{t(loc, "rl.pin")}</span><input name="password" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="current-password" placeholder="••••••" required /></label>
            </>
          ) : (
            <>
              <label className="lf"><span>{t(loc, "rl.email")}</span><input name="email" type="email" inputMode="email" autoComplete="username" required /></label>
              <label className="lf"><span>{t(loc, "acct.password")}</span><input name="password" type="password" autoComplete="current-password" required /></label>
            </>
          )}
          <button className={`btn ${as === "admin" ? "pri" : "sec"} rbtn${as === "driver" ? " xl" : ""}`}>{t(loc, `rl.${as}.signin` as MsgKey)}</button>
          {as === "owner" ? <p className="hint" style={{ textAlign: "center", marginTop: 10 }}><Link href="/forgot" className="lnk">{t(loc, "login.forgot")}</Link></p> : null}
          {as === "owner" ? <p className="sub" style={{ fontSize: 13, textAlign: "center", marginTop: 14 }}>{t(loc, "su.have")} <Link href="/signup" className="lnk">{t(loc, "su.cta")}</Link></p> : null}
          {as === "driver" ? <p className="hint" style={{ textAlign: "center" }}>{t(loc, "rl.driver.help")}</p> : null}
        </form>
      ) : <p className="sheet sub fade d1">{t(loc, "acct.disabled")}</p>}
      {as === "admin" ? <p className="admlink"><Link href="/login">← {t(loc, "rl.back")}</Link></p> : null}
      <nav className="loglang" aria-label={t(loc, "login.lang")}>{(["ro", "en", "pl"] as const).map((l) => <a key={l} href={`?lang=${l}`} className={l === loc ? "on" : ""} hrefLang={l}>{l.toUpperCase()}</a>)}</nav>
    </main>
  );
}
