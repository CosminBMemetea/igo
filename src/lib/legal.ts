// DRAFT — de revizuit de avocat înainte de lansarea comercială. Nu afișa „draft” în interfață.
import type { Locale } from "./i18n";
export interface LegalDoc { title: string; updated: string; intro: string; sections: [string, string][] }
const CO = "QUERRA S.R.L., CUI 53237645, Gepiu, județul Bihor, România";
export const PRIVACY: Record<Locale, LegalDoc> = {
  ro: {
    title: "Confidențialitate și GDPR", updated: "Ultima actualizare: 12.10.2026",
    intro: `Querra Fleet este operat de ${CO}. Aici explicăm ce date prelucrăm, unde sunt stocate și ce drepturi ai.`,
    sections: [
      ["Roluri: operator și persoană împuternicită", "Firma de transport care folosește Querra Fleet este operatorul datelor despre șoferii și camioanele sale. QUERRA S.R.L. este persoană împuternicită: prelucrăm datele doar la instrucțiunile firmei, pentru a furniza serviciul. Pentru datele contului (email, firmă, facturare) QUERRA S.R.L. este operator."],
      ["Ce date prelucrăm", "Datele firmei și ale utilizatorilor (nume, email, telefon), camioane, curse, alimentări și bonuri, documente cu expirare (ITP, RCA, rovinietă etc.) și, doar în timpul turei, poziția GPS trimisă din telefonul șoferului sau din GPS-ul conectat."],
      ["Unde sunt stocate datele", "În Uniunea Europeană: aplicația rulează pe Vercel în regiunea Frankfurt (fra1), iar baza de date este Neon Postgres în Frankfurt. Nu transferăm datele în afara UE pentru funcționarea serviciului."],
      ["Modul privat al șoferului", "Poziția se colectează doar cât șoferul este în tură. În afara turei sau în pauza privată nu colectăm, nu stocăm și nu afișăm nicio poziție; patronul vede doar „Privat”."],
      ["Cât păstrăm datele", "Cât timp firma are cont activ. La închiderea contului ștergem datele firmei, cu excepția celor pe care legea ne obligă să le păstrăm (de exemplu facturile)."],
      ["Drepturile tale", "Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, precum și dreptul de a depune plângere la ANSPDCP. Șoferii își exercită drepturile prin firma lor (operatorul); te ajutăm și noi."],
      ["Contact", "Scrie-ne din pagina Asistență din aplicație."],
    ],
  },
  en: {
    title: "Privacy and GDPR", updated: "Last updated: 12 Oct 2026",
    intro: `Querra Fleet is operated by ${CO}. This page explains what data we process, where it is stored and what your rights are.`,
    sections: [
      ["Roles: controller and processor", "The transport company using Querra Fleet is the controller of the data about its drivers and trucks. QUERRA S.R.L. is the processor: we process that data only on the company's instructions, to provide the service. For account data (email, company, billing) QUERRA S.R.L. is the controller."],
      ["What data we process", "Company and user data (name, email, phone), trucks, trips, fuel fills and receipts, expiring documents (inspection, insurance, vignette etc.) and, only during a shift, the GPS position sent from the driver's phone or a connected GPS device."],
      ["Where data is stored", "In the European Union: the app runs on Vercel in the Frankfurt region (fra1) and the database is Neon Postgres in Frankfurt. We do not transfer data outside the EU to run the service."],
      ["Driver private mode", "Positions are collected only while the driver is on shift. Off shift or during a private break we do not collect, store or display any position; the owner only sees “Private”."],
      ["How long we keep data", "As long as the company has an active account. When the account is closed we delete the company's data, except what the law requires us to keep (e.g. invoices)."],
      ["Your rights", "You have the right of access, rectification, erasure, restriction, portability and objection, and the right to complain to the Romanian supervisory authority (ANSPDCP). Drivers exercise their rights through their company (the controller); we help too."],
      ["Contact", "Write to us from the Support page in the app."],
    ],
  },
  pl: {
    title: "Prywatność i RODO", updated: "Ostatnia aktualizacja: 12.10.2026",
    intro: `Querra Fleet jest prowadzony przez ${CO}. Wyjaśniamy, jakie dane przetwarzamy, gdzie są przechowywane i jakie masz prawa.`,
    sections: [
      ["Role: administrator i podmiot przetwarzający", "Firma transportowa korzystająca z Querra Fleet jest administratorem danych swoich kierowców i ciężarówek. QUERRA S.R.L. jest podmiotem przetwarzającym: przetwarzamy dane wyłącznie na polecenie firmy, aby świadczyć usługę. Dla danych konta (email, firma, rozliczenia) administratorem jest QUERRA S.R.L."],
      ["Jakie dane przetwarzamy", "Dane firmy i użytkowników (imię i nazwisko, email, telefon), ciężarówki, kursy, tankowania i paragony, dokumenty z terminem ważności (przegląd, OC, winieta itd.) oraz — tylko w trakcie zmiany — pozycję GPS z telefonu kierowcy lub podłączonego urządzenia GPS."],
      ["Gdzie przechowujemy dane", "W Unii Europejskiej: aplikacja działa na Vercel w regionie Frankfurt (fra1), a baza danych to Neon Postgres we Frankfurcie. Do działania usługi nie przekazujemy danych poza UE."],
      ["Tryb prywatny kierowcy", "Pozycję zbieramy tylko w trakcie zmiany. Poza zmianą lub w prywatnej przerwie nie zbieramy, nie przechowujemy i nie pokazujemy żadnej pozycji; właściciel widzi tylko „Prywatnie”."],
      ["Jak długo przechowujemy dane", "Dopóki firma ma aktywne konto. Po zamknięciu konta usuwamy dane firmy, z wyjątkiem tych, które musimy przechowywać z mocy prawa (np. faktury)."],
      ["Twoje prawa", "Masz prawo dostępu, sprostowania, usunięcia, ograniczenia, przenoszenia i sprzeciwu oraz prawo do skargi do organu nadzorczego. Kierowcy realizują swoje prawa przez swoją firmę (administratora); my również pomagamy."],
      ["Kontakt", "Napisz do nas ze strony Pomoc w aplikacji."],
    ],
  },
};
export const TERMS: Record<Locale, LegalDoc> = {
  ro: {
    title: "Termeni și condiții", updated: "Ultima actualizare: 12.10.2026",
    intro: `Acești termeni se aplică folosirii Querra Fleet, furnizat de ${CO}.`,
    sections: [
      ["Serviciul", "Querra Fleet este o aplicație online pentru firme de transport: profit pe cursă, consum de motorină, alerte la alimentări, documente cu expirare și aplicația șoferului. Funcțiile marcate „În curând” nu fac încă parte din serviciu."],
      ["Contul și proba", "Contul se creează pentru o firmă, de către proprietar. Proba gratuită de 14 zile nu cere card. Datele demo sunt fictive."],
      ["Licență și plată", "După probă, serviciul se folosește pe baza unei licențe anuale per firmă, la prețurile afișate pe pagina Planuri, fără TVA. Hardware-ul (GPS, sondă) se cumpără separat, prin parteneri."],
      ["Datele tale", "Datele firmei îți aparțin. Le poți exporta sau cere ștergerea lor. Prelucrarea datelor personale este descrisă în pagina Confidențialitate."],
      ["Limitarea răspunderii", "Alertele și estimările sunt instrumente de ajutor, nu dovezi. Deciziile față de șoferi, clienți sau autorități rămân ale firmei. Nu răspundem pentru pierderi indirecte."],
      ["Disponibilitate", "Facem tot posibilul ca serviciul să fie disponibil permanent, cu excepția lucrărilor de mentenanță anunțate."],
      ["Legea aplicabilă", "Legea română. Litigiile se soluționează pe cale amiabilă, apoi de instanțele competente din România."],
    ],
  },
  en: {
    title: "Terms and conditions", updated: "Last updated: 12 Oct 2026",
    intro: `These terms apply to the use of Querra Fleet, provided by ${CO}.`,
    sections: [
      ["The service", "Querra Fleet is an online app for transport companies: profit per trip, fuel consumption, fuel-fill alerts, expiring documents and the driver app. Features marked “Coming soon” are not yet part of the service."],
      ["Account and trial", "An account is created for a company by its owner. The 14-day free trial needs no card. Demo data is fictitious."],
      ["Licence and payment", "After the trial, the service is used under an annual licence per company, at the prices shown on the Plans page, excluding VAT. Hardware (GPS, fuel probe) is bought separately through partners."],
      ["Your data", "The company's data belongs to you. You can export it or ask for it to be deleted. Processing of personal data is described on the Privacy page."],
      ["Limitation of liability", "Alerts and estimates are decision aids, not proof. Decisions about drivers, clients or authorities remain the company's. We are not liable for indirect losses."],
      ["Availability", "We do our best to keep the service available at all times, except for announced maintenance."],
      ["Governing law", "Romanian law. Disputes are settled amicably first, then by the competent courts in Romania."],
    ],
  },
  pl: {
    title: "Regulamin", updated: "Ostatnia aktualizacja: 12.10.2026",
    intro: `Niniejszy regulamin dotyczy korzystania z Querra Fleet, świadczonego przez ${CO}.`,
    sections: [
      ["Usługa", "Querra Fleet to aplikacja online dla firm transportowych: zysk na kurs, zużycie paliwa, alerty tankowań, dokumenty z terminem ważności i aplikacja kierowcy. Funkcje oznaczone „Wkrótce” nie są jeszcze częścią usługi."],
      ["Konto i okres próbny", "Konto zakłada właściciel dla firmy. 14-dniowy bezpłatny okres próbny nie wymaga karty. Dane demo są fikcyjne."],
      ["Licencja i płatność", "Po okresie próbnym usługa działa na podstawie rocznej licencji na firmę, według cen ze strony Plany, bez VAT. Sprzęt (GPS, sonda) kupuje się osobno, przez partnerów."],
      ["Twoje dane", "Dane firmy należą do Ciebie. Możesz je wyeksportować lub zażądać ich usunięcia. Przetwarzanie danych osobowych opisuje strona Prywatność."],
      ["Ograniczenie odpowiedzialności", "Alerty i szacunki są narzędziami pomocniczymi, nie dowodami. Decyzje wobec kierowców, klientów lub urzędów należą do firmy. Nie odpowiadamy za straty pośrednie."],
      ["Dostępność", "Dokładamy starań, aby usługa była stale dostępna, z wyjątkiem zapowiedzianych prac konserwacyjnych."],
      ["Prawo właściwe", "Prawo rumuńskie. Spory rozstrzygane są najpierw polubownie, a następnie przez właściwe sądy w Rumunii."],
    ],
  },
};
