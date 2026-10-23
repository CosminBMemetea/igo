import { getPrefs } from "@/lib/prefs";
import Link from "next/link";
import { PRIVACY } from "@/lib/legal";
import { tri } from "@/lib/i18n";
// DRAFT juridic — de revizuit de avocat (vezi src/lib/legal.ts).
export const dynamic = "force-dynamic";
// operatorul datelor (GDPR): doar denumirea + emailul de contact (fără CUI/adresă deocamdată)
const CTRL = { ro: ["Operatorul datelor", "Operatorul datelor pentru contul Querra Fleet și pentru cererile de pe site este", "contact"], en: ["Data controller", "The data controller for Querra Fleet accounts and website requests is", "contact"], pl: ["Administrator danych", "Administratorem danych kont Querra Fleet i zgłoszeń ze strony jest", "kontakt"] } as const;
export default async function Page() {
  const { loc } = (await getPrefs());
  const d = PRIVACY[loc], contact = process.env.CONTACT_EMAIL || process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || "";
  return (
    <main className="legal">
      <h1 className="h1 fade">{d.title}</h1>
      <p className="hint">{d.updated}</p>
      <p className="sub fade d1">{d.intro}</p>
      <section className="section" id="controller"><h2>{CTRL[loc][0]}</h2><p>{CTRL[loc][1]} <b>QUERRA S.R.L.</b>{contact ? <> · {CTRL[loc][2]}: <a className="lnk" href={`mailto:${contact}`}>{contact}</a></> : null}</p></section>
      {d.sections.map(([h, p]) => <section key={h} className="section"><h2>{h}</h2><p>{p}</p></section>)}
      <section className="section" id="subprocessors"><h2>{tri(loc, "Persoane împuternicite și DPA|Sub-processors and DPA|Podmioty przetwarzające i DPA")}</h2>
        <p><Link className="lnk" href="/subprocessors">{tri(loc, "Lista furnizorilor care prelucrează date|List of providers that process data|Lista dostawców przetwarzających dane")} →</Link></p>
        <p>{tri(loc, "DPA disponibil la cerere.|DPA available on request.|DPA dostępna na życzenie.")}</p></section>
    </main>
  );
}
