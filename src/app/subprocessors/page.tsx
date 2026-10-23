import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { tri } from "@/lib/i18n";
import { SUBPROCESSORS } from "@/lib/legal";
// DRAFT juridic — de revizuit de avocat (vezi src/lib/legal.ts).
export const dynamic = "force-dynamic";
export default async function Page() {
  const { loc } = await getPrefs();
  const contact = process.env.CONTACT_EMAIL || process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || "";
  return (
    <main className="legal">
      <h1 className="h1 fade">{tri(loc, "Persoane împuternicite|Sub-processors|Podmioty przetwarzające")}</h1>
      <p className="hint">{tri(loc, "Ultima actualizare: 23.10.2026|Last updated: 23 Oct 2026|Ostatnia aktualizacja: 23.10.2026")}</p>
      <p className="sub fade d1">{tri(loc, "Furnizorii care prelucrează date pentru Querra Fleet, ce fac și unde. Transferurile în afara UE se bazează pe clauzele contractuale standard (SCC) ale Comisiei Europene.|Providers that process data for Querra Fleet, what they do and where. Transfers outside the EU rely on the European Commission's standard contractual clauses (SCC).|Dostawcy przetwarzający dane dla Querra Fleet, ich rola i lokalizacja. Transfery poza UE opierają się na standardowych klauzulach umownych (SCC) Komisji Europejskiej.")}</p>
      {SUBPROCESSORS.map((x) => (
        <section key={x.name} className="section"><h2>{x.name}</h2>
          <p>{tri(loc, x.role)}</p>
          <p className="hint">{tri(loc, "Locație|Location|Lokalizacja")}: {tri(loc, x.where)} · {tri(loc, "Temei transfer|Transfer basis|Podstawa transferu")}: {tri(loc, x.transfer)}</p></section>
      ))}
      <section className="section"><h2>DPA</h2><p>{tri(loc, "DPA disponibil la cerere.|DPA available on request.|DPA dostępna na życzenie.")}</p>
        <p><b>QUERRA S.R.L.</b>{contact ? <> · <a className="lnk" href={`mailto:${contact}`}>{contact}</a></> : null}</p>
        <p><Link className="lnk" href="/privacy">← {tri(loc, "Confidențialitate|Privacy|Prywatność")}</Link></p></section>
    </main>
  );
}
