"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tri, type Locale } from "@/lib/i18n";
import { PROFILE_HEADERS, type ComplianceUpdate } from "@/lib/compliance-csv";
export function ComplianceImport({ loc }: { loc: Locale }) {
  const tr = (s: string) => tri(loc, s), router = useRouter(), lock = useRef(false), fileRead = useRef(0);
  const [text, setText] = useState(""), [preview, setPreview] = useState<{ stamp: string; changes: ComplianceUpdate[] } | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false);
  async function send(mode: "preview" | "commit") {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage(""); setError(false);
    try {
      const r = await fetch("/api/docs/vehicle-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, csv: text, stamp: preview?.stamp }) });
      const data = await r.json();
      if (r.status >= 500) throw new Error(tr("Serviciul nu este disponibil. Încearcă din nou.|Service unavailable. Try again.|Usługa niedostępna. Spróbuj ponownie."));
      if (!r.ok) throw new Error(data.error === "stale" ? tr("Datele s-au schimbat. Verifică din nou previzualizarea.|Data changed. Preview again.|Dane się zmieniły. Sprawdź podgląd ponownie.") : tr("CSV invalid: verifică antetul, numerele existente în flotă și datele din talon.|Invalid CSV: check the header, existing fleet plates and registration details.|Nieprawidłowy CSV: sprawdź nagłówek, numery we flocie i dane rejestracyjne.") + (data.rows?.length ? ` (${data.rows.join(", ")})` : ""));
      if (mode === "preview") setPreview(data);
      else { setPreview(null); setText(""); setMessage(tr("Datele vehiculelor au fost actualizate.|Vehicle details updated.|Dane pojazdów zaktualizowane.")); router.refresh(); }
    } catch (e) { setError(true); setMessage((e as Error).message); setPreview(null); }
    finally { lock.current = false; setBusy(false); }
  }
  return <details className="sheet compliance-import"><summary>{tr("Actualizează datele vehiculelor din CSV|Update vehicle details from CSV|Aktualizuj dane pojazdów z CSV")}</summary>
    <p className="hint">{tr("Descarcă datele actuale, editează și importă fișierul CSV (UTF-8, separator virgulă). Se actualizează doar vehicule existente. Câmpurile goale devin necunoscute; verifică înainte de salvare.|Download current details, edit and import the CSV (UTF-8, comma separated). Only existing vehicles are updated. Empty fields become unknown; review before saving.|Pobierz dane, edytuj i importuj CSV (UTF-8, przecinki). Aktualizowane są tylko istniejące pojazdy. Puste pola stają się nieznane; sprawdź przed zapisem.")}</p>
    <a className="btn sec sm" href="/api/docs/export?mode=profiles">{tr("Descarcă șablonul cu flota mea|Download my fleet template|Pobierz szablon mojej floty")}</a>
    <label className="lf"><span>CSV · max. 200 KB / 500 {tr("vehicule|vehicles|pojazdów")}</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => {
      const read = ++fileRead.current, f = e.target.files?.[0]; setPreview(null); setMessage(""); setText(""); setError(false);
      if (!f) return;
      if (f.size > 200000) { setError(true); setMessage(tr("Fișier prea mare.|File too large.|Plik za duży.")); return; }
      try { const value = await f.text(); if (fileRead.current === read) setText(value); }
      catch { if (fileRead.current === read) { setError(true); setMessage(tr("Fișierul nu poate fi citit. Selectează-l din nou.|Cannot read the file. Select it again.|Nie można odczytać pliku. Wybierz go ponownie.")); } }
    }} /></label>
    <button className="btn sec" type="button" disabled={!text || busy} onClick={() => send("preview")}>{tr("Verifică importul|Preview import|Sprawdź import")}</button>
    {preview ? <><div className="compliance-preview"><table><thead><tr>{PROFILE_HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{preview.changes.map(c => <tr key={c.id}><td>{c.plate}</td>{PROFILE_HEADERS.slice(1).map(k => <td key={k}>{String(c.next[k as keyof typeof c.next] ?? "—")}</td>)}</tr>)}</tbody></table></div><button className="btn pri" disabled={busy} type="button" onClick={() => send("commit")}>{tr("Salvează|Save|Zapisz")} · {preview.changes.length} {tr(preview.changes.length === 1 ? "vehicul|vehicle|pojazd" : "vehicule|vehicles|pojazdów")}</button></> : null}
    {busy ? <p role="status">{tr("Se procesează…|Processing…|Przetwarzanie…")}</p> : null}{message ? <p className={`msg ${error ? "err" : "ok"}`} role={error ? "alert" : "status"}>{message}</p> : null}
  </details>;
}
