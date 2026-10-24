import Link from "next/link";
import { redirect } from "next/navigation";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { getPrefs } from "@/lib/prefs";
import { tri } from "@/lib/i18n";
export const dynamic = "force-dynamic";
/** Calea reală pentru șoferi: aplicația web instalată pe ecranul telefonului (PWA), apoi autentificare cu telefon + PIN. */
export default async function Ready() {
  const tn = await tenant();
  if (tn.demo || tn.role !== "driver" || !tn.uid) redirect("/login");
  const me = await store().userById(tn.uid), { loc } = await getPrefs();
  return <main className="login"><h1 className="h1">{tri(loc, "Contul tău este activ|Your account is active|Twoje konto jest aktywne")}</h1><section className="sheet join-ready">
    <p>{tri(loc, "Pune Querra pe ecranul telefonului, apoi intră cu acest număr și PIN-ul ales acum.|Add Querra to your phone's home screen, then sign in with this number and the PIN you just chose.|Dodaj Querra do ekranu telefonu, a potem zaloguj się tym numerem i wybranym PIN-em.")}</p><strong>{me?.phone}</strong>
    <ol className="install-steps">
      <li><b>iPhone (Safari)</b>: {tri(loc, "apasă Partajează ⬆︎ → „Adaugă pe ecranul principal” → Adaugă.|tap Share ⬆︎ → “Add to Home Screen” → Add.|stuknij Udostępnij ⬆︎ → „Do ekranu początkowego” → Dodaj.")}</li>
      <li><b>Android (Chrome)</b>: {tri(loc, "apasă ⋮ → „Instalează aplicația” (sau „Adaugă pe ecranul de pornire”).|tap ⋮ → “Install app” (or “Add to Home screen”).|stuknij ⋮ → „Zainstaluj aplikację” (lub „Dodaj do ekranu głównego”).")}</li>
      <li>{tri(loc, "Deschide Querra de pe ecran și intră cu telefonul și PIN-ul.|Open Querra from the home screen and sign in with your phone and PIN.|Otwórz Querra z ekranu i zaloguj się telefonem i PIN-em.")}</li>
    </ol>
    <Link className="btn pri" href="/driver">{tri(loc, "Continuă acum în browser|Continue in the browser now|Kontynuuj teraz w przeglądarce")}</Link>
  </section></main>;
}
