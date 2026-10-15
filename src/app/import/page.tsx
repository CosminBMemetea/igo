import { SampleList } from "@/components/SampleList";
import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { fmtDate, fmtMoney, fmtNum, plural, t, tri, type MsgKey } from "@/lib/i18n";
import { store } from "@/lib/store";
import { tenant, writableFirm } from "@/lib/tenant";
import { truckBaseline } from "@/lib/firm-repo";
import { FIELDS, SOURCE_NAME, type Field, type Source } from "@/lib/fuel/parse";
import { fillToFill } from "@/lib/fuel/rules";
import { leiOf } from "@/lib/fuel/lei";
import { Gate } from "@/components/Gate";
import { ImportBox } from "@/components/ImportBox";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";
const SAMPLES = (an: string): [string, string][] => [["dkv", "DKV"], ["dkv-europa", "DKV Europa (HUF, EUR, PLN, TRY, CHF)"], ["omv-routex", "OMV / Routex"], ["mol", "MOL"], ["shell", "Shell"], ["e100", "E100"], ["generic", "CSV generic"], ["anomalii", an], ["manual-mapare", "CSV manual (cp1250)"]];
const LKEYS = ["drop", "eur", "eur1", "peg", "otherCur", "dropHint", "reading", "detected", "rows", "sure", "unsure", "new", "dupes", "matched", "skipped", "period", "nonfuel", "showMap", "hideMap", "missing", "check", "unknown", "unknownHint", "unknownMeta", "card", "assign", "addTruck", "go", "done", "err", "big", "delim", "enc", "cols", "saved", "savedHint", "prev", "saveNote", "errs", "line", "more", "why_date", "why_litres", "why_nonfuel", "why_id", "try", "demoDone", "demoReport", "demoAlerts", "demoNoAlerts", "again"] as const;
export default async function Import({ searchParams }: { searchParams: { e?: string; assigned?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const tr = (s: string) => tri(loc, s);
  const tn = await tenant();
  const f = await writableFirm();
  const head = (
    <>
      <div className="eyebrow fade">{t(loc, "imp.eyebrow")}</div>
      <h1 className="h1 fade">{t(loc, "imp.title")}</h1>
      <p className="sub fade d1">{t(loc, "imp.sub")}</p>
      <details className="sheet fuel-help"><summary>{tr("Cum adaug cardul de carburant al camionului?|How do I add a truck's fuel card?|Jak dodać kartę paliwową pojazdu?")}</summary>
        <ol><li>{tr("Adaugă camionul din Camioane, apoi asociază aici identificatorul cardului cu numărul de înmatriculare.|Add the truck in Trucks, then link the card identifier to its registration here.|Dodaj pojazd w Pojazdach, następnie powiąż tutaj identyfikator karty z numerem rejestracyjnym.")}</li>
        <li>{tr("Descarcă fișierul CSV din portalul furnizorului (DKV, OMV/Routex, MOL, Shell sau E100) și încarcă-l mai jos. Verifică previzualizarea înainte de import.|Download the CSV from your provider (DKV, OMV/Routex, MOL, Shell or E100) and upload it below. Review the preview before importing.|Pobierz CSV od dostawcy (DKV, OMV/Routex, MOL, Shell lub E100) i prześlij poniżej. Sprawdź podgląd przed importem.")}</li>
        <li>{tr("Dacă numărul de înmatriculare este recunoscut, asocierea se face automat. Pentru cardurile necunoscute, alegi camionul din listă.|Recognized registration numbers are matched automatically. For unknown cards, select the truck from the list.|Rozpoznane numery rejestracyjne są dopasowywane automatycznie. Dla nieznanych kart wybierz pojazd z listy.")}</li></ol>
        <p className="hint">{tr("Folosește identificatorul exact din CSV, inclusiv zerourile inițiale. Nu se cer PIN, CVV sau parola furnizorului. Asocierea nu conectează automat contul furnizorului; tranzacțiile vin prin import CSV.|Use the exact identifier from the CSV, including leading zeros. No PIN, CVV or provider password is needed. Linking a card does not connect the provider account; transactions arrive through CSV import.|Użyj dokładnego identyfikatora z CSV, z zerami początkowymi. Nie podawaj PIN-u, CVV ani hasła dostawcy. Powiązanie karty nie łączy konta dostawcy; transakcje pochodzą z importu CSV.")}</p>
      </details>
    </>
  );
  const labels: Record<string, string> = { ...Object.fromEntries(LKEYS.map((k) => [k, t(loc, `imp.${k}` as MsgKey)])), fillUnit: t(loc, "u.fill"), loc };
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
              <SampleList samples={samples} tryLabel={t(loc, "imp.tryOne")} />
            </div>
          </div>
        </section>
      </main>
    </Gate>
  );
  if (!f || tn.demo) return <Gate feature="cardCsv" prefs={prefs}><main className="setup">{head}<div className="msg warn">{f ? t(loc, "imp.demoOn") : t(loc, "set.e.nofirm")}</div></main></Gate>;
  const s = store();
  const [trucks, tx, imports, cards] = await Promise.all([s.trucks(f.id), s.fuel(f.id, { limit: 50000 }), s.imports(f.id), s.fuelCards(f.id)]);
  if (!trucks.length) return <Gate feature="cardCsv" prefs={prefs}><main className="setup">{head}<EmptyState kind="driverOwner" loc={loc} /></main></Gate>;
  const since = f.createdAt.slice(0, 16);
  const unassigned = new Map<string, { n: number; litres: number; plate: string | null }>();
  for (const x of tx) if (!x.truckId && x.card) { const u = unassigned.get(x.card) ?? { n: 0, litres: 0, plate: x.plate }; u.n++; u.litres += x.litres; unassigned.set(x.card, u); }
  return (
    <Gate feature="cardCsv" prefs={prefs}>
      <main className="setup">
        {head}
        {searchParams.assigned ? <p className="msg ok">{t(loc, "set.saved")}</p> : searchParams.e ? <p className="msg err">{t(loc, "imp.err")}</p> : null}
        <section className="sheet" id="cards">
          <h2>{tr("Carduri de carburant|Fuel cards|Karty paliwowe")}</h2>
          <p className="hint">{tr("Poți asocia cardul înainte de primul import. Asocierea se aplică tuturor tranzacțiilor acelui card, inclusiv celor deja importate. Nu muta un card între camioane pentru perioade diferite din acest formular.|You can link a card before the first import. The mapping applies to all transactions for that card, including previous imports. Do not use this form to move a card between trucks for different periods.|Możesz powiązać kartę przed pierwszym importem. Powiązanie dotyczy wszystkich transakcji karty, także wcześniejszych importów. Nie używaj tego formularza do przenoszenia karty między pojazdami dla różnych okresów.")}</p>
          <form action="/api/import/assign" method="post" className="invrow" style={{ marginTop: 16 }}>
            <label className="lf"><span>{tr("Identificator card din CSV|Card identifier from CSV|Identyfikator karty z CSV")}</span><input name="card" required maxLength={40} autoComplete="off" placeholder="DKV-001234" /></label>
            <label className="lf"><span>{tr("Camion|Truck|Pojazd")}</span><select name="truck" required defaultValue=""><option value="" disabled>{tr("Alege camionul|Choose truck|Wybierz pojazd")}</option>{trucks.filter((x) => !x.archivedAt).map((x) => <option key={x.id} value={x.id}>{x.plate}</option>)}</select></label>
            <button className="btn pri">{tr("Salvează asocierea|Save mapping|Zapisz powiązanie")}</button>
          </form>
          {cards.length ? <div className="fuel-card-list">{cards.map((c) => <div key={c.card}><code>{c.card}</code><span>{trucks.find((x) => x.id === c.truckId)?.plate ?? tr("Neasociat|Unassigned|Nieprzypisane")}</span></div>)}</div> : <p className="hint">{tr("Niciun card asociat încă.|No cards linked yet.|Brak powiązanych kart.")}</p>}
        </section>
        <section className="sgrid">
          <ImportBox labels={labels} fieldLabels={fieldLabels} samples={samples} />
          <div>
            <div className="sheet">
              <div className="eyebrow">{t(loc, "imp.samples")}</div>
              <p className="hint" style={{ margin: "6px 0 12px" }}>{t(loc, "imp.samplesHint")}</p>
              <p className="hint">{tr("Exemplele se testează în demo. În firma ta, încarcă exportul real al furnizorului.|Try samples in demo mode. In your company, upload the actual provider export.|Przykłady testuj w demo. W swojej firmie prześlij rzeczywisty eksport dostawcy.")}</p>
              <div className="chips">{samples.map(([key, name]) => <a key={key} className="btn sec sm" href={`/samples/${key}.csv`} download>{name} ↓</a>)}</div>
            </div>
            {unassigned.size ? (
              <div className="sheet" style={{ marginTop: 16 }}>
                <div className="eyebrow">{t(loc, "imp.unknown")}</div>
                <div className="list" style={{ marginTop: 10 }}>
                  {[...unassigned].map(([card, u]) => (
                    <form key={card} action="/api/import/assign" method="post" className="it" style={{ cursor: "default", flexWrap: "wrap" }}>
                      <input type="hidden" name="card" value={card} />
                      <div style={{ minWidth: 0 }}><div className="t">{t(loc, "imp.card")} {card}</div><div className="m">{t(loc, "imp.unknownMeta", { fills: plural(loc, u.n, "u.fill"), litres: fmtNum(loc, u.litres) })}</div></div>
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
              const lei = mine.reduce((a, x) => a + (leiOf(x) ?? 0), 0);
              return (
                <div key={tr.id} className="it" style={{ cursor: "default" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t">{tr.plate}</div>
                    <div className="m">{t(loc, "imp.truckMeta", { fills: plural(loc, mine.length, "u.fill"), litres: fmtNum(loc, mine.reduce((a, x) => a + x.litres, 0)), lei: fmtMoney(loc, lei) })}</div>
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
                  <div style={{ minWidth: 0 }}><div className="t">{SOURCE_NAME[m.source as Source] ?? m.source} · {m.filename || "—"}</div><div className="m">{new Date(m.createdAt).toLocaleString(loc === "en" ? "en-GB" : loc === "pl" ? "pl-PL" : "ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {t(loc, "imp.histMeta", { added: m.added, dupes: m.dupes, skipped: m.skipped })}</div></div>
                  <span className="badge acc">+{m.added}</span>
                </div>
              ))}
            </div>
          ) : <p className="sub">{tr("Niciun import încă. Încarcă exportul CSV al furnizorului.|No imports yet. Upload your provider's CSV export.|Brak importów. Prześlij eksport CSV dostawcy.")}</p>}
        </section>
      </main>
    </Gate>
  );
}
