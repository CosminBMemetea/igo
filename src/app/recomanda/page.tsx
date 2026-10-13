import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { LT } from "@/lib/lead-i18n";
import { refCode } from "@/lib/referral";
import { fmtDate } from "@/lib/i18n";
import { CopyBtn } from "./CopyBtn";

export const dynamic = "force-dynamic";
/** „Recomandă”: linkul ?ref=COD al firmei + firmele venite prin el. Recompensa e doar afișată (o lună gratuită). */
export default async function Refer() {
  const { loc } = getPrefs(), L = LT[loc];
  const tn = await tenant();
  const real = !tn.demo && tn.firm && tn.role === "owner";
  const code = real ? refCode(tn.firm!.id) : "DEMQRT2";
  const link = `https://fleet.querra.net/incearca?ref=${code}`;
  const referred = real ? (await store().firms()).filter((f) => f.referredBy === code) : [];
  return (
    <main style={{ maxWidth: 720 }}>
      <div className="eyebrow fade">🎁 {L.refNav}</div>
      <h1 className="h1 fade">{L.refTitle}</h1>
      <p className="sub fade d1">{L.refSub}</p>
      <div className="sheet fade d2 refbox" style={{ marginTop: 24 }}>
        <span className="badge ok" style={{ alignSelf: "flex-start" }}>{L.refReward}</span>
        <div className="k" style={{ marginTop: 14 }}>{L.refLink}</div>
        <div className="refrow"><code>{link}</code><CopyBtn text={link} label={L.refCopy} done={L.refCopied} /></div>
        <div className="m" style={{ marginTop: 10 }}>{L.refCode}: <b style={{ letterSpacing: ".12em" }}>{code}</b></div>
        {!real ? <p className="hint" style={{ marginTop: 10 }}>{L.refDemo}</p> : null}
      </div>
      <section className="section">
        <div className="eyebrow">{L.refList}</div>
        <div className="list" style={{ marginTop: 14 }}>
          {referred.map((f) => <div key={f.id} className="it" style={{ cursor: "default" }}><div><div className="t">{f.name}</div><div className="m">{fmtDate(loc, f.createdAt.slice(0, 10), true)}</div></div></div>)}
          {!referred.length ? <div className="empty"><p>{L.refNone}</p></div> : null}
        </div>
      </section>
    </main>
  );
}
