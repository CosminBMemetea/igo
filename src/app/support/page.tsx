import { getPrefs } from "@/lib/prefs";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
/** „Asistență Querra”: cerere salvată în baza de date + contactul lui Cosmin (din env SUPPORT_*). */
export default function Support({ searchParams }: { searchParams: { sent?: string; e?: string } }) {
  const { loc } = getPrefs();
  const phone = process.env.SUPPORT_PHONE;
  return (
    <main className="login" style={{ maxWidth: 520 }}>
      <div className="eyebrow fade">{t(loc, "sup.eyebrow")}</div>
      <h1 className="h1 fade">{t(loc, "sup.title")}</h1>
      <p className="sub fade d1">{t(loc, "sup.sub")}</p>
      <div className="sheet fade d1 contact">
        <div className="k">{t(loc, "sup.contact")}</div>
        <div className="t">QUERRA S.R.L.</div>
        <div className="m">CUI 53237645 · {t(loc, "ft.addr")}</div>
        {phone ? <a className="lnk" href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a> : null}
        <p className="hint" style={{ marginTop: 6 }}>{t(loc, "sup.formHint")}</p>
      </div>
      {searchParams.sent ? <p className="msg ok">{t(loc, "sup.sent")}</p> : (
        <form className="sheet fade d2" action="/api/support" method="post">
          {searchParams.e ? <p className="msg err">{t(loc, "sup.err")}</p> : null}
          <label className="lf"><span>{t(loc, "sup.name")}</span><input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
          <label className="lf"><span>{t(loc, "join.phone")}</span><input name="phone" type="tel" required autoComplete="tel" /></label>
          <label className="lf"><span>{t(loc, "sup.slot")}</span>
            <select name="slot" defaultValue="morning">
              <option value="morning">{t(loc, "sup.slot.morning")}</option>
              <option value="noon">{t(loc, "sup.slot.noon")}</option>
              <option value="evening">{t(loc, "sup.slot.evening")}</option>
            </select>
          </label>
          <label className="lf"><span>{t(loc, "sup.msg")}</span><textarea name="message" rows={3} maxLength={1000} placeholder={t(loc, "sup.msgPh")} /></label>
          <button className="btn pri" style={{ width: "100%", marginTop: 8 }}>{t(loc, "sup.submit")}</button>
        </form>
      )}
    </main>
  );
}
