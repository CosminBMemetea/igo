import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import type { Locale } from "@/lib/i18n";
export const dynamic = "force-dynamic";
// Pagină scurtă, publică: ce vede patronul și ce nu (în sincron cu /privacy și cu aplicația șoferului).
const C: Record<Locale, { title: string; sub: string; sees: [string, string[]]; not: [string, string[]]; keep: [string, string]; more: string }> = {
  ro: {
    title: "Ce vede patronul și ce nu", sub: "Pe scurt, pentru șoferi și patroni. Aceleași reguli pentru toate firmele.",
    sees: ["Patronul vede", ["Poziția camionului doar în timpul turei, de la „Începe tura” până la „Termină tura”.", "Km și ore pe tură, consumul și alimentările (cardul de carburant și bonurile trimise).", "Documentele cursei: CMR, POD, încărcat / descărcat.", "În pauza privată: doar eticheta „Privat”, fără poziție."]],
    not: ["Patronul nu vede", ["Unde ești în afara turei: nu trimitem și nu salvăm nicio poziție.", "Unde ești în pauza privată: telefonul nu trimite poziția până apeși „Reiau tura”.", "Nimic din telefon în afara aplicației: contacte, poze, mesaje."]],
    keep: ["Cât păstrăm", "Datele cursei și pozițiile din tură se păstrează cât timp firma are cont activ și se șterg la închiderea contului (în afară de ce cere legea, de exemplu facturile). Datele sunt găzduite în UE (Frankfurt)."],
    more: "Detalii complete în politica de confidențialitate",
  },
  en: {
    title: "What the owner sees — and what not", sub: "In short, for drivers and owners. The same rules for every company.",
    sees: ["The owner sees", ["The truck's position only during a shift, from “Start shift” to “End shift”.", "Km and hours per shift, fuel use and fill-ups (fuel card and receipts sent).", "Trip paperwork: CMR, POD, loaded / unloaded.", "During a private break: only the “Private” label, no position."]],
    not: ["The owner does not see", ["Where you are outside a shift: no position is sent or stored.", "Where you are during a private break: the phone sends no position until you tap “Resume shift”.", "Anything on your phone outside the app: contacts, photos, messages."]],
    keep: ["How long we keep it", "Trip data and shift positions are kept while the company account is active and deleted when the account closes (except what the law requires, e.g. invoices). Data is hosted in the EU (Frankfurt)."],
    more: "Full details in the privacy policy",
  },
  pl: {
    title: "Co widzi właściciel, a czego nie", sub: "W skrócie, dla kierowców i właścicieli. Te same zasady dla każdej firmy.",
    sees: ["Właściciel widzi", ["Pozycję ciężarówki tylko w trakcie zmiany, od „Rozpocznij zmianę” do „Zakończ zmianę”.", "Km i godziny na zmianę, zużycie paliwa i tankowania (karta paliwowa i wysłane paragony).", "Dokumenty kursu: CMR, POD, załadunek / rozładunek.", "W przerwie prywatnej: tylko etykietę „Prywatnie”, bez pozycji."]],
    not: ["Właściciel nie widzi", ["Gdzie jesteś poza zmianą: nie wysyłamy ani nie zapisujemy żadnej pozycji.", "Gdzie jesteś w przerwie prywatnej: telefon nie wysyła pozycji, dopóki nie wznowisz zmiany.", "Niczego w telefonie poza aplikacją: kontaktów, zdjęć, wiadomości."]],
    keep: ["Jak długo przechowujemy", "Dane kursów i pozycje ze zmian przechowujemy, dopóki konto firmy jest aktywne, i usuwamy po jego zamknięciu (poza tym, czego wymaga prawo, np. faktury). Dane są hostowane w UE (Frankfurt)."],
    more: "Pełne informacje w polityce prywatności",
  },
};
export default function Visibility() {
  const { loc } = getPrefs(), c = C[loc];
  return (
    <main className="legal vis">
      <h1 className="h1 fade">{c.title}</h1>
      <p className="sub fade d1">{c.sub}</p>
      <section className="section vgrid">
        <div className="vcard yes"><h2>{c.sees[0]}</h2><ul>{c.sees[1].map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="vcard no"><h2>{c.not[0]}</h2><ul>{c.not[1].map((x) => <li key={x}>{x}</li>)}</ul></div>
      </section>
      <section className="section"><h2>{c.keep[0]}</h2><p>{c.keep[1]}</p><p><Link className="link" href="/privacy">{c.more} →</Link></p></section>
    </main>
  );
}
