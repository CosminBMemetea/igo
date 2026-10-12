import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, fmtMoney, fmtNum, t, type MsgKey } from "@/lib/i18n";
import { store } from "@/lib/store";
import { tenant, writableFirm } from "@/lib/tenant";
import { truckBaseline } from "@/lib/firm-repo";
import { FIELDS, SOURCE_NAME, type Field, type Source } from "@/lib/fuel/parse";
import { fillToFill } from "@/lib/fuel/rules";
import { Gate } from "@/components/Gate";
import { ImportBox } from "@/components/ImportBox";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";
const SAMPLES = (an: string): [string, string][] => [["dkv", "DKV"], ["omv-routex", "OMV / Routex"], ["mol", "MOL"], ["shell", "Shell"], ["e100", "E100"], ["generic", "CSV generic"], ["anomalii", an], ["manual-mapare", "CSV manual (cp1250)"]];
const LKEYS = ["drop", "dropHint", "reading", "detected", "rows", "sure", "unsure", "new", "dupes", "matched", "skipped", "period", "nonfuel", "showMap", "hideMap", "missing", "check", "unknown", "unknownHint", "unknownMeta", "card", "assign", "addTruck", "go", "done", "err", "big", "delim", "enc", "cols", "saved", "savedHint", "prev", "saveNote", "errs", "line", "more", "why_date", "why_litres", "why_nonfuel", "why_id", "try", "demoDone", "demoReport", "demoAlerts", "demoNoAlerts", "again"] as const;
export default async function Import({ searchParams }: { searchParams: { e?: string; assigned?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const tn = await tenant();
  const f = await writableFirm();
  const head = (
    <>
      <div className="eyebrow fade">{t(loc, "imp.eyebrow")}</div>
      <h1 className="h1 fade">{t(loc, "imp.title")}</h1>
      <p className="sub fade d1">{t(loc, "imp.sub")}</p>
    </>
  );
  const labels = Object.fromEntries(LKEYS.map((k) => [k, t(loc, `imp.${k}` as MsgKey)]));
  const fieldLabels = Object.fromEntries(FIELDS.map((x) => [x, t(loc, `imp.f.${x}` as MsgKey)])) as Record<Field, string>;
  const samples = SAMPLES(t(loc, "imp.anomalies"));
  if (!f && tn.demo && (tn.role === "user" || tn.role === "admin")) return (
    <Gate feature="cardCsv" prefs={prefs}>
      <main className="setup">
        {head}
        <p className="msg demobox">{t(loc, "imp.demoSandbox")}</p>
        <section className="sgrid">
          <ImportBox labels={labels} fieldLabels={fieldLabels} demo samples={samples} />
          <div>
            <div className="sheet">
              <div className="eyebrow">{t(loc, "imp.samples")}</div>
              <p className="hint" style={{ margin: "6px 0 12px" }}>{t(loc, "imp.demoSamplesHint")}</p>
              <div className="chips">{samples.map(([k, n]) => <a key={k} className="btn sec sm" href={`/samples/${k}.csv`} download>{n}</a>)}</div>
            </div>
          </div>
        </section>
      </main>
    </Gate>
  );
  if (!f || tn.demo) return <Gate feature="cardCsv" prefs={prefs}><main className="setup">{head}<div className="msg warn">{f ? t(loc, "imp.demoOn") : t(loc, "set.e.nofirm")}</div></main></Gate>;
  const s = store();
  const [trucks, tx, imports] = await Promise.all([s.trucks(f.id), s.fuel(f.id, { limit: 50000 }), s.imports(f.id)]);
  if (!trucks.length) return <Gate feature="cardCsv" prefs={prefs}><main className="setup">{head}<EmptyState kind="driverOwner" loc={loc} /></main></Gate>;
  const since = f.createdAt.slice(0, 16);
  const unassigned = new Map<string, { n: number; litres: number; plate: string | null }>();
  for (const x of tx) if (!x.truckId && x.card) { const u = unassigned.get(x.card) ?? { n: 0, litres: 0, plate: x.plate }; u.n++; u.litres += x.litres; unassigned.set(x.card, u); }
  return (
    <Gate feature="cardCsv" prefs={prefs}>
      <main className="setup">
        {head}
        {searchParams.assigned ? <p className="msg ok">{t(loc, "set.saved")}</p> : searchParams.e ? <p className="msg err">{t(loc, "imp.err")}</p> : null}
        <section className="sgrid">
          <ImportBox labels={labels} fieldLabels={fieldLabels} samples={samples} />
          <div>
            <div className="sheet">
              <div className="eyebrow">{t(loc, "imp.samples")}</div>
              <p className="hint" style={{ margin: "6px 0 12px" }}>{t(loc, "imp.samplesHint")}</p>
              <div className="chips">{SAMPLES(t(loc, "imp.anomalies")).map(([k, n]) => <a key={k} className="btn sec sm" href={`/samples/${k}.csv`} download>{n}</a>)}</div>
            </div>
            {unassigned.size ? (
              <div className="sheet" style={{ marginTop: 16 }}>
                <div className="eyebrow">{t(loc, "imp.unknown")}</div>
                <div className="list" style={{ marginTop: 10 }}>
                  {[...unassigned].map(([card, u]) => (
                    <form key={card} action="/api/import/assign" method="post" className="it" style={{ cursor: "default", flexWrap: "wrap" }}>
                      <input type="hidden" name="card" value={card} />
                      <div style={{ minWidth: 0 }}><div className="t">{t(loc, "imp.card")} {card}</div><div className="m">{t(loc, "imp.unknownMeta", { n: u.n, litres: fmtNum(loc, u.litres) })}</div></div>
                      <div className="copy"><select name="truck" className="tsel" required>{trucks.map((x) => <option key={x.id} value={x.id}>{x.plate}</option>)}</select><button className="btn pri sm">{t(loc, "imp.save")}</button></div>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="section">
          <div className="head"><h2>{t(loc, "imp.byTruck")}</h2><Link className="link" href="/alerts">{t(loc, "home.allAlerts")}</Link></div>
          <div className="list">
            {trucks.map((tr) => {
              const mine = tx.filter((x) => x.truckId === tr.id);
              const b = truckBaseline(tr, tx, since), recent = fillToFill(mine.filter((x) => x.at >= since).map((x) => ({ ...x })));
              const lei = mine.reduce((a, x) => a + (x.amount ?? 0), 0);
              return (
                <div key={tr.id} className="it" style={{ cursor: "default" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t">{tr.plate}</div>
                    <div className="m">{t(loc, "imp.truckMeta", { n: mine.length, litres: fmtNum(loc, mine.reduce((a, x) => a + x.litres, 0)), lei: fmtMoney(loc, lei) })}</div>
                    <div className="m">{t(loc, `imp.base.${b.kind}` as MsgKey, { l100: fmtNum(loc, b.l100, 1), km: fmtNum(loc, b.km) })}{recent.l100 ? ` · ${t(loc, "imp.now", { l100: fmtNum(loc, recent.l100, 1) })}` : ""}</div>
                  </div>
                  {mine.length ? <span className="badge ok">✓</span> : <span className="badge">{t(loc, "imp.noData")}</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="section">
          <div className="head"><h2>{t(loc, "imp.history")}</h2></div>
          {imports.length ? (
            <div className="list">
              {imports.map((m) => (
                <div key={m.id} className="it" style={{ cursor: "default" }}>
                  <div style={{ minWidth: 0 }}><div className="t">{SOURCE_NAME[m.source as Source] ?? m.source} · {m.filename || "—"}</div><div className="m">{fmtDate(loc, m.createdAt.slice(0, 16))} · {t(loc, "imp.histMeta", { added: m.added, dupes: m.dupes, skipped: m.skipped })}</div></div>
                  <span className="badge acc">+{m.added}</span>
                </div>
              ))}
            </div>
          ) : <p className="sub">{t(loc, "imp.noHistory")}</p>}
        </section>
      </main>
    </Gate>
  );
}
