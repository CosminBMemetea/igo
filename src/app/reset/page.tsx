import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { t, type MsgKey } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { readReset } from "@/lib/reset";
export const dynamic = "force-dynamic";
const ERR: Record<string, MsgKey> = { token: "rst.e.token", weak: "rst.e.weak", mismatch: "join.e.mismatch" };
export default async function Reset({ searchParams }: { searchParams: { t?: string; e?: string } }) {
  const { loc } = getPrefs();
  const ok = !!(await readReset(searchParams.t, process.env.SESSION_SECRET)), err = ERR[searchParams.e ?? ""] ?? (ok ? null : ERR.token);
  return (
    <main className="login r-owner">
      <div className="fade" style={{ color: "var(--fg)", marginBottom: 18 }}><Logo height={44} /></div>
      <h1 className="h1 fade">{t(loc, "rst.newTitle")}</h1>
      {err ? <p className="msg err" role="alert">{t(loc, err)}</p> : null}
      {ok ? (
        <form className="sheet fade d1" action="/api/auth/reset" method="post">
          <input type="hidden" name="t" value={searchParams.t} />
          <label className="lf"><span>{t(loc, "rst.new")}</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label className="lf"><span>{t(loc, "rst.new2")}</span><input name="password2" type="password" autoComplete="new-password" minLength={8} required /></label>
          <p className="hint">{t(loc, "rst.rule")}</p>
          <button className="btn pri">{t(loc, "rst.save")}</button>
        </form>
      ) : <p className="admlink"><Link href="/forgot" className="btn sec">{t(loc, "rst.again")}</Link></p>}
      <p className="admlink"><Link href="/login">← {t(loc, "rl.back")}</Link></p>
    </main>
  );
}
