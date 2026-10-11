import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { fmtDate, fmtMoney, fmtNum, fmtPct, t, type MsgKey } from "@/lib/i18n";
import { ASSUME, economii } from "@/lib/economii";
import { Gate } from "@/components/Gate";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";
const eurF = (loc: Parameters<typeof fmtNum>[0]) => (n: number) => `${fmtNum(loc, Math.round(n / ASSUME.eurRon))} €`;
export default async function Savings() {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  if (!d.demo && !d.trips.length) return <main><EmptyState kind="trips" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const days = d.demo ? 30 : Math.max(1, Math.round((Date.now() - Date.parse(d.tn.firm?.createdAt ?? new Date().toISOString())) / 86400000));
  const e = economii(d.views, d.alerts, d.vehicles, days), eur = eurF(loc);
  const keys = ["fuel", "theft", "docs", "time", "cash"] as const;
  const max = Math.max(...keys.map((k) => Math.abs(e.lines[k])), 1);
  const how: Record<(typeof keys)[number], string> = {
    fuel: t(loc, "sav.how.fuel", { l: fmtNum(loc, Math.round(e.fuel.savedLitres)), pct: fmtPct(loc, e.fuel.pct) }),
    theft: t(loc, "sav.how.theft", { l: fmtNum(loc, e.theftL), price: fmtNum(loc, e.price, 2) }),
    docs: t(loc, "sav.how.docs", { n: e.docsN, fine: fmtMoney(loc, ASSUME.fineLei) }),
    time: t(loc, "sav.how.time", { h: e.hours, rate: ASSUME.hourLei, n: d.vehicles.length }),
    cash: t(loc, "sav.how.cash", { n: d.vehicles.length }),
  };
  return (
    <Gate feature="savings" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "sav.eyebrow")}</div>
        <div className="big fade pos" style={{ marginTop: 8 }}>{fmtMoney(loc, e.total)}</div>
        <p className="sub fade d1" dangerouslySetInnerHTML={{ __html: t(loc, "sav.sub", { eur: eur(e.total), days, h: e.hours }) }} />
        <section className="section">
          <div className="head"><h2>{t(loc, "sav.byCat")}</h2></div>
          <div className="wf">
            {keys.map((k) => (
              <div key={k} className="r" style={{ alignItems: "start" }}>
                <span>{t(loc, `sav.cat.${k}` as MsgKey)}{k !== "fuel" && k !== "theft" ? <small className="est"> · {t(loc, "sav.est")}</small> : null}<small className="d" style={{ display: "block", color: "var(--fg2)", fontSize: 12, marginTop: 4, maxWidth: 360 }}>{how[k]}</small></span>
                <div className="bar"><i style={{ left: 0, width: `${(Math.abs(e.lines[k]) / max) * 100}%`, background: e.lines[k] < 0 ? "var(--neg)" : k === "fuel" || k === "theft" ? "var(--pos)" : "var(--fg2)" }} /></div>
                <span className="v">{fmtMoney(loc, e.lines[k])}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="section grid2">
          <div className="card"><div className="k">{t(loc, "sav.year")} · {t(loc, "sav.est")}</div><div className="n">{fmtMoney(loc, e.year)}</div><div className="d">{t(loc, "sav.yearSub", { eur: eur(e.year), n: d.vehicles.length })}</div></div>
          <div className="card"><div className="k">{t(loc, "sav.hours")}</div><div className="n">{e.hours} h</div><div className="d">{t(loc, "sav.hoursSub", { h: Math.round((e.hours / e.months) * 12) })}</div></div>
        </section>
        {e.best.length ? (
          <section className="section">
            <div className="head"><h2>{t(loc, "sav.trucks")}</h2><Link className="link" href="/trips">{t(loc, "home.all")}</Link></div>
            <div className="list">
              {[...e.best, ...e.worst.filter((w) => !e.best.includes(w))].map((x) => (
                <Link key={x.v.id} href={`/vehicles/${x.v.id}`} className="it"><div><div className="t">{x.v.name}</div><div className="m">{x.v.model} · {fmtPct(loc, x.pct)}</div></div><span className={`v ${x.lei < 0 ? "neg" : "pos"}`}>{fmtMoney(loc, x.lei)}</span></Link>
              ))}
            </div>
          </section>
        ) : null}
        <section className="section">
          <div className="head"><h2>{t(loc, "sav.assume")}</h2></div>
          <p className="sub" style={{ fontSize: 14 }}>{t(loc, "sav.assumeText", { rate: fmtNum(loc, ASSUME.eurRon, 4), date: fmtDate(loc, ASSUME.eurDate, true), hour: ASSUME.hourLei, price: fmtNum(loc, e.price, 2) })}</p>
        </section>
      </main>
    </Gate>
  );
}
