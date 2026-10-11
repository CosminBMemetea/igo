import { getPrefs } from "@/lib/prefs";
import { t, type MsgKey } from "@/lib/i18n";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";
const ERR: Record<string, MsgKey> = { bad: "acct.bad", disabled: "acct.disabled", nosecret: "acct.nosecret" };
import Link from "next/link";
export default function Login({ searchParams }: { searchParams: { e?: string } }) {
  const { loc } = getPrefs();
  const secret = (process.env.SESSION_SECRET?.length ?? 0) >= 32, enabled = secret;
  const err = searchParams.e && ERR[searchParams.e];
  return (
    <main className="login">
      <div className="fade" style={{ color: "var(--fg)", marginBottom: 18 }}><Logo height={44} /></div>
      <h1 className="h1 fade">{t(loc, "acct.title")}</h1>
      <p className="sub fade d1">{t(loc, "acct.sub")}</p>
      {err ? <p className="msg err">{t(loc, err)}</p> : null}
      {enabled ? (
        <form className="sheet fade d1" action="/api/auth/login" method="post">
          <label className="lf"><span>{t(loc, "acct.login")}</span><input name="email" type="text" inputMode="email" autoComplete="username" required /></label>
          <label className="lf"><span>{t(loc, "acct.password")}</span><input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn pri" style={{ width: "100%", marginTop: 8 }}>{t(loc, "acct.signin")}</button>
          <p className="sub" style={{ fontSize: 13, textAlign: "center", marginTop: 14 }}>{t(loc, "su.have")} <Link href="/signup" className="lnk">{t(loc, "su.cta")}</Link></p>
        </form>
      ) : <p className="sheet sub fade d1">{t(loc, "acct.disabled")}</p>}
      <div className="or">{t(loc, "acct.or")}</div>
      <form action="/api/auth/demo" method="post" className="fade d2">
        <button className="btn sec" style={{ width: "100%" }} disabled={!secret}>{t(loc, "acct.demo")}</button>
        <p className="sub" style={{ fontSize: 13, textAlign: "center", marginTop: 10 }}>{secret ? t(loc, "acct.demoHint") : t(loc, "acct.nosecret")}</p>
      </form>
    </main>
  );
}
