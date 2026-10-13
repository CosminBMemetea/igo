import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { LT, FUEL_CARDS } from "@/lib/lead-i18n";
import { normRef } from "@/lib/referral";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type SP = { sent?: string; e?: string; ref?: string } & Partial<Record<(typeof UTM)[number], string>>;
/** Pagina publică „Încearcă gratuit 30 de zile”: formular de lead (fără prețuri). */
export default function TryFree({ searchParams }: { searchParams: SP }) {
  const { loc } = getPrefs(), L = LT[loc];
  const ref = normRef(searchParams.ref);
  const utm = UTM.map((k) => [k, String(searchParams[k] ?? "").slice(0, 80)] as const).filter(([, v]) => v);
  if (searchParams.sent) return (
    <main className="login" style={{ maxWidth: 520 }}>
      <span className="logo" style={{ display: "inline-block", marginBottom: 28 }}><Logo /></span>
      <div className="lcheck fade" aria-hidden="true">✓</div>
      <h1 className="h1 fade">{L.sent}</h1>
      <p className="sub fade d1">{L.sentSub}</p>
      <Link className="btn pri" href="/login" style={{ marginTop: 24 }}>{L.demo} →</Link>
    </main>
  );
  return (
    <main className="login lead" style={{ maxWidth: 560 }}>
      <Link href="/login" className="logo" style={{ display: "inline-block", marginBottom: 28 }} aria-label="Querra Fleet"><Logo /></Link>
      <div className="eyebrow fade">{L.eyebrow}</div>
      <h1 className="h1 fade">{L.title}</h1>
      <p className="sub fade d1">{L.sub}</p>
      {ref ? <p className="msg ok fade d1">🎁 {L.refNote}</p> : null}
      <form className="sheet fade d2" action="/api/leads" method="post" style={{ marginTop: 22 }}>
        {searchParams.e ? <p className="msg err" role="alert">{searchParams.e === "rate" ? L.errRate : L.err}</p> : null}
        <input type="hidden" name="locale" value={loc} />
        <input type="hidden" name="t0" value={Date.now()} />
        {ref ? <input type="hidden" name="ref" value={ref} /> : null}
        {utm.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {/* honeypot: câmp ascuns pentru oameni; boții îl completează */}
        <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="lf"><span>{L.firm}</span><input name="firm" required minLength={2} maxLength={120} autoComplete="organization" /></label>
        <label className="lf"><span>{L.person}</span><input name="person" required minLength={2} maxLength={80} autoComplete="name" /></label>
        <div className="grid2 lgrid">
          <label className="lf"><span>{L.phone}</span><input name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="07xx xxx xxx" /></label>
          <label className="lf"><span>{L.email}</span><input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
        </div>
        <div className="grid2 lgrid">
          <label className="lf"><span>{L.trucks}</span><input name="trucks" type="number" inputMode="numeric" required min={1} max={5000} placeholder="10" /></label>
          <label className="lf"><span>{L.card}</span>
            <select name="fuelCard" defaultValue="DKV">{FUEL_CARDS.map((c) => <option key={c} value={c}>{c === "other" ? L.cardOther : c === "none" ? L.cardNone : c}</option>)}</select>
          </label>
        </div>
        <fieldset className="lf lgps"><span>{L.gps}</span>
          <div className="radio"><label><input type="radio" name="gps" value="yes" /><i>{L.yes}</i></label><label><input type="radio" name="gps" value="no" defaultChecked /><i>{L.no}</i></label></div>
        </fieldset>
        <label className="lf"><span>{L.gpsProvider}</span><input name="gpsProvider" maxLength={80} placeholder={L.gpsPh} /></label>
        <label className="lconsent"><input type="checkbox" name="consent" value="1" required /><span>{L.consent} <Link href="/privacy" target="_blank" className="lnk">{L.privacy}</Link>. {L.noMkt}</span></label>
        <button className="btn pri xl" style={{ width: "100%", marginTop: 10 }}>{L.submit} →</button>
      </form>
    </main>
  );
}
