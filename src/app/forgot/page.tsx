import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
export const dynamic = "force-dynamic";
export default function Forgot({ searchParams }: { searchParams: { sent?: string } }) {
  const { loc } = getPrefs();
  return (
    <main className="login r-owner">
      <div className="fade" style={{ color: "var(--fg)", marginBottom: 18 }}><Logo height={44} /></div>
      <h1 className="h1 fade">{t(loc, "rst.title")}</h1>
      <p className="sub fade d1">{t(loc, "rst.sub")}</p>
      {searchParams.sent ? <p className="msg ok" role="status">{t(loc, "rst.sent")}</p> : (
        <form className="sheet fade d1" action="/api/auth/forgot" method="post">
          <label className="lf"><span>{t(loc, "rl.email")}</span><input name="email" type="email" inputMode="email" autoComplete="username" required /></label>
          <button className="btn pri">{t(loc, "rst.send")}</button>
          <p className="hint">{t(loc, "rst.driverHint")}</p>
        </form>
      )}
      <p className="admlink"><Link href="/login">← {t(loc, "rl.back")}</Link></p>
    </main>
  );
}
