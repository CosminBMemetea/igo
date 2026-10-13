import type { Locale } from "./i18n";
// Textele pentru /incearca (probă gratuită), emailurile lead-ului și „Recomandă” (RO / EN / PL).
const RO = {
  eyebrow: "Probă gratuită", title: "Încearcă gratuit 30 de zile", sub: "Toate funcțiile deblocate, fără card. Îți configurăm noi contul pe camioanele tale și te sunăm în 1–2 zile lucrătoare.",
  cta: "Încearcă gratuit 30 de zile", loginLink: "Încearcă gratuit 30 de zile →",
  firm: "Firmă", person: "Persoană de contact", phone: "Telefon", email: "Email", trucks: "Număr de camioane",
  card: "Card de carburant", cardOther: "Altul", cardNone: "Niciunul", gps: "Ai deja GPS pe camioane?", yes: "Da", no: "Nu", gpsProvider: "Furnizor GPS (opțional)", gpsPh: "ex. Arobs, Webeye, Frotcom",
  consent: "Sunt de acord ca Querra Fleet să-mi prelucreze datele pentru a mă contacta despre proba gratuită. Detalii în", privacy: "Politica de confidențialitate", noMkt: "Nu trimitem newslettere sau mesaje de marketing.",
  submit: "Trimite cererea", sent: "Mulțumim! Am primit cererea.", sentSub: "Ți-am trimis o confirmare pe email. Te contactăm în 1–2 zile lucrătoare.", demo: "Până atunci, vezi demo-ul",
  err: "Verifică câmpurile marcate: firmă, persoană, telefon, email valid, număr de camioane și acordul GDPR.", errRate: "Prea multe cereri de pe această conexiune. Încearcă din nou mai târziu.",
  refNote: "Ai fost recomandat de un client Querra Fleet.",
  mailAdminSubj: "Lead nou: {firm} ({trucks} camioane)", mailLeadSubj: "Am primit cererea ta — Querra Fleet",
  mailLead: "Bună, {person}!\n\nAm primit cererea pentru proba gratuită de 30 de zile Querra Fleet pentru {firm}. Te contactăm în 1–2 zile lucrătoare la {phone}.\n\nNu te-am abonat la nicio listă; acesta e singurul email automat.\n\nEchipa Querra Fleet",
  refTitle: "Recomandă Querra Fleet", refSub: "Trimite linkul de mai jos unei alte firme de transport. Când devine client, primești o lună gratuită.", refReward: "Recompensă: o lună gratuită", refLink: "Linkul tău de recomandare", refCode: "Codul tău", refCopy: "Copiază", refCopied: "Copiat ✓", refList: "Firme recomandate de tine", refNone: "Încă nicio firmă recomandată.", refDemo: "În demo: un exemplu de cod. Firmele reale primesc un cod unic.", refNav: "Recomandă",
  admLeads: "Cereri probă gratuită ({n})", admNoLeads: "Nicio cerere încă.", admRefs: "Recomandări ({n})", admNoRefs: "Nicio firmă venită prin recomandare.", admRefBy: "recomandată de {by}",
};
type L = typeof RO;
const EN: L = {
  eyebrow: "Free trial", title: "Try it free for 30 days", sub: "Every feature unlocked, no card. We set up the account on your trucks and call you within 1–2 working days.",
  cta: "Try it free for 30 days", loginLink: "Try it free for 30 days →",
  firm: "Company", person: "Contact person", phone: "Phone", email: "Email", trucks: "Number of trucks",
  card: "Fuel card", cardOther: "Other", cardNone: "None", gps: "Do your trucks already have GPS?", yes: "Yes", no: "No", gpsProvider: "GPS provider (optional)", gpsPh: "e.g. Webfleet, Frotcom",
  consent: "I agree that Querra Fleet may process my data to contact me about the free trial. Details in the", privacy: "Privacy policy", noMkt: "We don't send newsletters or marketing messages.",
  submit: "Send request", sent: "Thank you! We got your request.", sentSub: "We've emailed you a confirmation. We'll get in touch within 1–2 working days.", demo: "Meanwhile, see the demo",
  err: "Please check the fields: company, person, phone, valid email, number of trucks and the GDPR consent.", errRate: "Too many requests from this connection. Please try again later.",
  refNote: "You were referred by a Querra Fleet customer.",
  mailAdminSubj: "New lead: {firm} ({trucks} trucks)", mailLeadSubj: "We received your request — Querra Fleet",
  mailLead: "Hi {person},\n\nWe received the request for the 30-day free Querra Fleet trial for {firm}. We'll contact you within 1–2 working days at {phone}.\n\nWe haven't subscribed you to any list; this is the only automatic email.\n\nThe Querra Fleet team",
  refTitle: "Refer Querra Fleet", refSub: "Send the link below to another transport company. When they become a customer, you get one month free.", refReward: "Reward: one month free", refLink: "Your referral link", refCode: "Your code", refCopy: "Copy", refCopied: "Copied ✓", refList: "Companies you referred", refNone: "No referred companies yet.", refDemo: "Demo: a sample code. Real companies get a unique code.", refNav: "Refer",
  admLeads: "Free-trial requests ({n})", admNoLeads: "No requests yet.", admRefs: "Referrals ({n})", admNoRefs: "No companies came through a referral.", admRefBy: "referred by {by}",
};
const PL: L = {
  eyebrow: "Darmowy okres próbny", title: "Wypróbuj za darmo przez 30 dni", sub: "Wszystkie funkcje odblokowane, bez karty. Skonfigurujemy konto dla Twoich ciężarówek i zadzwonimy w ciągu 1–2 dni roboczych.",
  cta: "Wypróbuj za darmo przez 30 dni", loginLink: "Wypróbuj za darmo przez 30 dni →",
  firm: "Firma", person: "Osoba kontaktowa", phone: "Telefon", email: "E-mail", trucks: "Liczba ciężarówek",
  card: "Karta paliwowa", cardOther: "Inna", cardNone: "Brak", gps: "Czy ciężarówki mają już GPS?", yes: "Tak", no: "Nie", gpsProvider: "Dostawca GPS (opcjonalnie)", gpsPh: "np. Webfleet, Frotcom",
  consent: "Zgadzam się na przetwarzanie moich danych przez Querra Fleet w celu kontaktu w sprawie okresu próbnego. Szczegóły w", privacy: "Polityce prywatności", noMkt: "Nie wysyłamy newsletterów ani wiadomości marketingowych.",
  submit: "Wyślij zgłoszenie", sent: "Dziękujemy! Otrzymaliśmy zgłoszenie.", sentSub: "Wysłaliśmy potwierdzenie e-mailem. Odezwiemy się w ciągu 1–2 dni roboczych.", demo: "W międzyczasie zobacz demo",
  err: "Sprawdź pola: firma, osoba, telefon, poprawny e-mail, liczba ciężarówek i zgoda RODO.", errRate: "Zbyt wiele zgłoszeń z tego połączenia. Spróbuj ponownie później.",
  refNote: "Polecił Cię klient Querra Fleet.",
  mailAdminSubj: "Nowy lead: {firm} ({trucks} ciężarówek)", mailLeadSubj: "Otrzymaliśmy Twoje zgłoszenie — Querra Fleet",
  mailLead: "Dzień dobry, {person}!\n\nOtrzymaliśmy zgłoszenie na 30-dniowy darmowy okres próbny Querra Fleet dla {firm}. Skontaktujemy się w ciągu 1–2 dni roboczych pod numerem {phone}.\n\nNie zapisaliśmy Cię na żadną listę; to jedyny automatyczny e-mail.\n\nZespół Querra Fleet",
  refTitle: "Poleć Querra Fleet", refSub: "Wyślij poniższy link innej firmie transportowej. Gdy zostanie klientem, dostajesz miesiąc za darmo.", refReward: "Nagroda: miesiąc za darmo", refLink: "Twój link polecający", refCode: "Twój kod", refCopy: "Kopiuj", refCopied: "Skopiowano ✓", refList: "Firmy polecone przez Ciebie", refNone: "Brak poleconych firm.", refDemo: "Demo: przykładowy kod. Prawdziwe firmy dostają unikalny kod.", refNav: "Poleć",
  admLeads: "Zgłoszenia na okres próbny ({n})", admNoLeads: "Brak zgłoszeń.", admRefs: "Polecenia ({n})", admNoRefs: "Brak firm z polecenia.", admRefBy: "polecona przez {by}",
};
export const LT: Record<Locale, L> = { ro: RO, en: EN, pl: PL };
export type LeadText = L;
export const lfill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
export const FUEL_CARDS = ["DKV", "OMV", "Eurowag", "Shell", "MOL", "other", "none"] as const;
