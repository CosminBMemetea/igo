"use client";
import { COMPLIANCE_LABELS, complianceBadge } from "@/lib/compliance-labels";
import { useState } from "react";
import Link from "next/link";
import { needsAttention, roadRegime, vehicleCompliance } from "@/lib/compliance";
import { tri, t, fmtDate, type Locale, type MsgKey } from "@/lib/i18n";
import type { Doc, Vehicle } from "@/lib/fleet/seed";

export function ComplianceCard({ vehicle: v, docs, today, loc, driver = false, demo = false }: { vehicle: Vehicle; docs: Doc[]; today: string; loc: Locale; driver?: boolean; demo?: boolean }) {
  const tr = (s: string) => tri(loc, s), regime = roadRegime(v.compliance);
  const items = vehicleCompliance(v.compliance, docs.filter(d => d.scope === "vehicle" && d.ownerId === v.id), today);
  const alerts = items.filter(needsAttention), critical = alerts.filter(i => ["expired", "missing", "future"].includes(i.state));
  const rows = <ul className="compliance-items">{items.filter(i => i.state !== "not-applicable").map(i => <li key={i.type}>
    <div><strong>{i.type === "classification" ? tr("Date din talon|Registration details|Dane rejestracyjne") : i.type === "tollro" ? "TollRo" : t(loc, `doc.${i.type}` as MsgKey)}</strong>
      {i.doc?.expires ? <small>{i.state === "future" && i.doc.validFrom ? `${tr("Începe|Starts|Początek")} ${fmtDate(loc, i.doc.validFrom, true)} · ` : ""}{tr("Expiră|Expires|Wygasa")} {fmtDate(loc, i.doc.expires, true)}</small> : null}
      {i.type === "tollro" ? <small>{tr("Verifică tichetul sau sesiunea pentru traseu. Plata nu este confirmată în Querra Fleet.|Check the ticket or session for the route. Payment is not confirmed in Querra Fleet.|Sprawdź bilet lub sesję dla trasy. Płatność nie jest potwierdzona w Querra Fleet.")}</small> : null}
      {i.type === "classification" ? <small>{tr("Completează datele pentru stabilirea obligațiilor.|Complete the details to determine obligations.|Uzupełnij dane, aby ustalić obowiązki.")}</small> : null}
      {i.doc?.fileId ? <a className="link" href={`/api/files/${encodeURIComponent(i.doc.fileId)}`} target="_blank" rel="noreferrer">{t(loc, "dc.openFile")}</a> : null}
    </div>
    <div className="compliance-item-action"><span className={`badge ${complianceBadge(i.state)}`}>{tr(COMPLIANCE_LABELS[i.state])}</span>
      {!driver && !demo && i.type !== "tollro" && needsAttention(i) ? <Link className="link" href={i.type === "classification" ? `/trucks#truck-${v.id}` : i.doc ? `/documents?tab=vehicles&edit=${encodeURIComponent(i.doc.id)}` : `/documents?tab=vehicles&add=1&truck=${encodeURIComponent(v.id)}&type=${i.type}`}>{tr(i.type === "classification" ? "Completează|Complete|Uzupełnij" : i.doc ? "Actualizează|Update|Aktualizuj" : "Adaugă|Add|Dodaj")}</Link> : null}
    </div>
  </li>)}</ul>;
  return <article className={`compliance-card${driver ? " compliance-driver" : ""}`}>
    <div className="compliance-card-head"><div><h3>{v.name}</h3><p>{regime === "tollro" ? "TollRo · " + tr("după distanță|distance based|według odległości") : regime === "vignette" ? "Rovinietă · " + tr("după perioadă|time based|okresowa") : tr("Regim rutier de stabilit|Road charging regime unknown|System opłat do ustalenia")}</p></div><span className={`badge ${critical.length ? "bad" : alerts.length ? "warn" : "ok"}`}>{alerts.length ? `${alerts.length} ${tr("de verificat|to check|do sprawdzenia")}` : tr("În termen · declarat|In date · declared|W terminie · deklaracja")}</span></div>
    {driver ? <details open={critical.length > 0}><summary>{tr("Documente înainte de plecare|Documents before departure|Dokumenty przed wyjazdem")}</summary>{critical.length ? <p className="msg warn">{tr("Sunt documente lipsă, expirate sau cu valabilitate viitoare. Confirmă situația cu patronul înainte de plecare.|Some documents are missing, expired or not yet active. Confirm with the owner before departure.|Brakujące, wygasłe lub przyszłe dokumenty. Potwierdź stan z właścicielem przed wyjazdem.")}</p> : null}{rows}</details> : rows}
    <div className="compliance-card-foot"><small>{tr("Evidență declarată, fără verificare în registre oficiale.|Declared records, not checked against official registers.|Dane zadeklarowane, bez weryfikacji w rejestrach urzędowych.")}</small>
      <a className="btn sec sm" href="https://portal.etoll.ro/" target="_blank" rel="noopener noreferrer">{tr("Verifică / cumpără pe eToll ↗|Check / buy on eToll ↗|Sprawdź / kup na eToll ↗")}</a>
    </div>
  </article>;
}
export function ComplianceDashboard({ vehicles, docs, today, loc, demo }: { vehicles: Vehicle[]; docs: Doc[]; today: string; loc: Locale; demo: boolean }) {
  const [state, setState] = useState("all"), [regime, setRegime] = useState("all"), [category, setCategory] = useState("all");
  const tr = (s: string) => tri(loc, s);
  const rows = vehicles.filter(v => !v.archived).map(v => ({ v, items: vehicleCompliance(v.compliance, docs.filter(d => d.scope === "vehicle" && d.ownerId === v.id), today) }));
  const filtered = rows.filter(({v,items}) => (regime === "all" || roadRegime(v.compliance) === regime) && (category === "all" || (v.compliance?.category ?? "unknown") === category) && (state === "all" || (state === "attention" ? items.some(needsAttention) : state === "soon" ? items.some(i => i.state === "soon" || i.state === "urgent") : items.some(i => i.state === state))));
  return <section className="compliance-dashboard" aria-label={tr("Documentele flotei|Fleet documents|Dokumenty floty")}>
    <div className="compliance-stats">{[[rows.length, tr("vehicule active|active vehicles|aktywne pojazdy")], [rows.filter(r => r.items.some(i => i.state === "expired")).length, tr("cu documente expirate|with expired documents|z wygasłymi dokumentami")], [rows.filter(r => r.items.some(i => i.state === "missing")).length, tr("cu documente lipsă|with missing documents|z brakującymi dokumentami")], [rows.filter(r => r.items.some(i => i.state === "unknown")).length, tr("cu verificări necesare|requiring checks|wymagające sprawdzenia")]].map(([n,label]) => <div key={label}><strong>{n}</strong><span>{label}</span></div>)}</div>
    <div className="compliance-filters">
      <label className="lf"><span>{tr("Stare|Status|Status")}</span><select value={state} onChange={e => setState(e.target.value)}>{[["all","Toate|All|Wszystkie"],["attention","De verificat|Needs attention|Do sprawdzenia"],["missing","Lipsă|Missing|Brakujące"],["expired","Expirate|Expired|Wygasłe"],["soon","Expiră în 30 zile|Expiring within 30 days|Wygasają w 30 dni"]].map(([v,l]) => <option key={v} value={v}>{tr(l)}</option>)}</select></label>
      <label className="lf"><span>{tr("Taxă rutieră|Road charge|Opłata drogowa")}</span><select value={regime} onChange={e => setRegime(e.target.value)}><option value="all">{tr("Toate|All|Wszystkie")}</option><option value="vignette">Rovinietă</option><option value="tollro">TollRo</option><option value="unknown">{tr("Necunoscut|Unknown|Nieznany")}</option></select></label>
      <label className="lf"><span>{tr("Categoria|Category|Kategoria")}</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">{tr("Toate|All|Wszystkie")}</option>{[...new Set(rows.map(r => r.v.compliance?.category ?? "unknown"))].sort().map(c => <option key={c} value={c}>{c === "unknown" ? tr("Necunoscut|Unknown|Nieznana") : c}</option>)}</select></label>
    </div>
    <div className="compliance-grid">{filtered.map(({v}) => <ComplianceCard key={v.id} vehicle={v} docs={docs} today={today} loc={loc} demo={demo} />)}</div>
    {!filtered.length ? <p className="sub">{tr("Niciun vehicul pentru filtrele selectate.|No vehicles match these filters.|Brak pojazdów dla wybranych filtrów.")}</p> : null}
    <p className="hint">{tr("Taxele de drum se verifică pentru rețeaua și deplasarea efectivă. Excepțiile și vehiculele speciale necesită verificare individuală.|Check road charges for the actual network and journey. Exemptions and special vehicles need individual review.|Sprawdź opłaty dla sieci dróg i przejazdu. Wyjątki i pojazdy specjalne wymagają indywidualnej oceny.")}</p>
  </section>;
}
