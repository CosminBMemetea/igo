import { getPrefs } from "@/lib/prefs";
import { t, type MsgKey } from "@/lib/i18n";
import { readInvite } from "@/lib/invite";
import { store } from "@/lib/store";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";
const ERR: Record<string, MsgKey> = { token: "join.e.token", used: "join.e.used", phone: "join.e.phone", pin: "join.e.pin", phoneused: "join.e.phoneused", revoked: "join.e.revoked", weak: "join.e.weak", len: "join.e.len", mismatch: "join.e.mismatch" };
/** Pagina deschisă de șofer pe telefon din linkul de invitație. */
export default async function Join({ searchParams }: { searchParams: { t?: string; e?: string } }) {
  const { loc } = getPrefs();
  const inv = await readInvite(searchParams.t, process.env.SESSION_SECRET);
  const row = inv ? await store().invite(inv.firm, inv.inv) : null;
  const firm = inv ? await store().firm(inv.firm) : null;
  const bad = !row || !firm ? "token" : row.usedAt ? "used" : row.revokedAt ? "revoked" : null;
  const err = ERR[bad ?? searchParams.e ?? ""];
  return (
    <main className="login">
      <div className="fade" style={{ color: "var(--fg)", marginBottom: 18 }}><Logo height={44} /></div>
      <h1 className="h1 fade">{bad ? t(loc, "join.title0") : t(loc, "join.title", { name: row!.name.split(" ")[0] })}</h1>
      {!bad ? <p className="sub fade d1">{t(loc, "join.sub", { firm: firm!.name })}</p> : null}
      {err ? <p className="msg err">{t(loc, err)}</p> : null}
      {!bad ? (
        <form className="sheet fade d1" action="/api/auth/join" method="post">
          <input type="hidden" name="t" value={searchParams.t} />
          <label className="lf"><span>{t(loc, "join.phone")}</span><input name="phone" type="tel" required defaultValue={row!.phone ?? ""} autoComplete="tel" /></label>
          <label className="lf"><span>{t(loc, "join.pin")}</span><input name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="new-password" /></label>
          <label className="lf"><span>{t(loc, "join.pin2")}</span><input name="pin2" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="new-password" /></label>
          <p className="hint">{t(loc, "join.hint")}</p>
          <button className="btn pri" style={{ width: "100%", marginTop: 8 }}>{t(loc, "join.submit")}</button>
        </form>
      ) : <p className="sub">{t(loc, "join.ask")}</p>}
    </main>
  );
}
