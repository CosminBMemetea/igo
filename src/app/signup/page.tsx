import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { t, type MsgKey } from "@/lib/i18n";
import { dbConfigured } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { normRef } from "@/lib/referral";

export const dynamic = "force-dynamic";
const ERR: Record<string, MsgKey> = { firm: "su.e.firm", email: "su.e.email", password: "su.e.password", cui: "su.e.cui", exists: "su.e.exists", nosecret: "acct.nosecret", form: "su.e.firm" };
export default async function Signup(props: { searchParams: Promise<{ e?: string; ref?: string }> }) {
  const searchParams = await props.searchParams;
  const { loc } = (await getPrefs());
  const err = searchParams.e && ERR[searchParams.e];
  return (
    <main className="login">
      <div className="fade" style={{ color: "var(--fg)", marginBottom: 18 }}><Logo height={44} /></div>
      <h1 className="h1 fade">{t(loc, "su.title")}</h1>
      <p className="sub fade d1">{t(loc, "su.sub")}</p>
      {!dbConfigured() ? <p className="msg warn">{t(loc, "su.noDb")}</p> : null}
      {err ? <p className="msg err">{t(loc, err)}</p> : null}
      <form className="sheet fade d1" action="/api/auth/signup" method="post">
        {normRef(searchParams.ref) ? <input type="hidden" name="ref" value={normRef(searchParams.ref)!} /> : null}
        <label className="lf"><span>{t(loc, "su.firm")}</span><input name="firm" required minLength={2} maxLength={120} autoComplete="organization" /></label>
        <label className="lf"><span>{t(loc, "su.cui")}</span><input name="cui" maxLength={20} placeholder="RO12345678" /></label>
        <label className="lf"><span>{t(loc, "acct.email")}</span><input name="email" type="email" required autoComplete="email" /></label>
        <label className="lf"><span>{t(loc, "acct.password")}</span><input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <p className="hint">{t(loc, "su.pwHint")}</p>
        <button className="btn pri" style={{ width: "100%", marginTop: 8 }}>{t(loc, "su.submit")}</button>
        <p className="sub" style={{ fontSize: 13, textAlign: "center", marginTop: 14 }}>{t(loc, "su.trial")}</p>
      </form>
      <p className="sub" style={{ fontSize: 13, textAlign: "center", marginTop: 22 }}><Link href="/login" className="lnk">{t(loc, "su.back")}</Link></p>
    </main>
  );
}
