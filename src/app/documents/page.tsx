import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { repo } from "@/lib/repo";
import { fmtDate, fmtNum, t, type MsgKey } from "@/lib/i18n";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";
const DEMO = Date.UTC(2026, 9, 15);
export default async function Documents({ searchParams }: { searchParams: { tab?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const r = repo();
  const [docs, vehicles, services] = await Promise.all([r.docs(), r.vehicles(), r.services()]);
  const tab = ["vehicles", "drivers", "trips", "service"].includes(searchParams.tab ?? "") ? searchParams.tab! : "vehicles";
  const days = (iso: string) => Math.round((Date.parse(iso) - DEMO) / 86400000);
  const soon = docs.filter((d) => d.expires && days(d.expires) <= 30).sort((a, b) => a.expires!.localeCompare(b.expires!));
  const vname = (id: string) => vehicles.find((v) => v.id === id)?.name ?? id;
  const scope = { vehicles: "vehicle", drivers: "driver", trips: "trip" } as const;
  const list = tab === "service" ? [] : docs.filter((d) => d.scope === scope[tab as "vehicles"]);
  const color = (n: number) => (n <= 7 ? "var(--neg)" : n <= 30 ? "#f5a524" : "var(--pos)");
  const body = (
    <main>
      <div className="eyebrow fade">{t(loc, "docs.title")}</div>
      <div className="big fade" style={{ marginTop: 8 }}>{soon.length}</div>
      <p className="sub fade d1">{t(loc, "docs.sub")}{soon[0] ? <> · <b>{t(loc, `doc.${soon[0].type}` as MsgKey)} {vname(soon[0].ownerId)} · {t(loc, "docs.days", { n: days(soon[0].expires!) })}</b></> : null}</p>
      <div className="seg fade d2" style={{ marginTop: 40 }}>
        {(["vehicles", "trips", "drivers", "service"] as const).map((k) => <Link key={k} href={`/documents?tab=${k}`} className={tab === k ? "on" : ""}>{t(loc, `docs.${k}`)}</Link>)}
      </div>
      <section className="section" style={{ marginTop: 28 }}>
        {tab === "service" ? (
          <Gate feature="maintenance" prefs={prefs} inline>
            <div className="cards">
              {services.map((s) => <div className="card" key={s.vehicleId + s.kind}><div className="k">{vname(s.vehicleId)}</div><div className="n">{fmtNum(loc, s.remaining)} {s.unit === "days" ? t(loc, "docs.days", { n: "" }).trim() : s.unit}</div><div className="d">{t(loc, `svc.${s.kind}`)}</div><div className="meter"><i style={{ width: `${s.progress * 100}%`, background: s.progress > 0.9 ? "var(--neg)" : s.progress > 0.7 ? "#f5a524" : "var(--pos)" }} /></div></div>)}
            </div>
          </Gate>
        ) : (
          <div className="list">
            {tab === "trips" ? <p className="sub" style={{ marginBottom: 12 }}>{t(loc, "docs.tripNote")}</p> : null}
            {list.map((d, i) => {
              const n = d.expires ? days(d.expires) : null;
              return (
                <div key={d.id} className={`it fade d${Math.min(4, i)}`}>
                  <div>
                    <div className="t">{t(loc, `doc.${d.type}` as MsgKey)} · {d.scope === "vehicle" ? vname(d.ownerId) : d.scope === "trip" ? d.ownerId.replace(/-(\d+)$/, " · $1 oct") : d.ownerId}</div>
                    <div className="m">{d.provider ? `${d.provider} · ` : ""}{d.expires ? `${t(loc, "docs.expires")} ${fmtDate(loc, d.expires, true)}` : "✓"}</div>
                    {n != null ? <div className="meter" style={{ width: 220 }}><i style={{ width: `${Math.max(8, 100 - Math.min(100, n / 3.65))}%`, background: color(n) }} /></div> : null}
                  </div>
                  {n != null ? <span className={`badge ${n <= 7 ? "bad" : n <= 30 ? "warn" : "ok"}`}>{n <= 30 ? t(loc, "docs.days", { n }) : t(loc, "docs.ok")}</span> : <span className="badge ok">✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
  return <Gate feature="documents" prefs={prefs}>{body}</Gate>;
}
