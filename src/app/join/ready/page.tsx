import Link from "next/link";
import { redirect } from "next/navigation";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { getPrefs } from "@/lib/prefs";
import { tri } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export default async function Ready() {
  const tn = await tenant();
  if (tn.demo || tn.role !== "driver" || !tn.uid) redirect("/login");
  const me = await store().userById(tn.uid), { loc } = await getPrefs();
  const query = `login?phone=${encodeURIComponent(me?.phone ?? "")}`;
  return <main className="login"><h1 className="h1">{tri(loc, "Contul tău este activ|Your account is active|Twoje konto jest aktywne")}</h1><section className="sheet">
    <p>{tri(loc, "Intră în aplicație cu acest număr și PIN-ul pe care tocmai l-ai ales.|Sign into the app with this number and the PIN you just chose.|Zaloguj się w aplikacji tym numerem i wybranym PIN-em.")}</p><strong>{me?.phone}</strong>
    <div className="invrow"><a className="btn pri" href={`qfleet-driver://${query}`}>{tri(loc, "Deschide Querra Șofer|Open Querra Driver|Otwórz Querra Kierowca")}</a><a className="btn sec" href={`qfleet-driver-test://${query}`}>{tri(loc, "Deschide aplicația Android de test|Open Android test app|Otwórz testową aplikację Android")}</a></div>
    <p className="hint">{tri(loc, "Dacă aplicația nu este instalată, continuă în browser. Linkul nu include PIN-ul.|If the app is not installed, continue in your browser. The link does not contain your PIN.|Jeśli aplikacja nie jest zainstalowana, kontynuuj w przeglądarce. Link nie zawiera PIN-u.")}</p>
    <Link className="btn sec" href="/driver">{tri(loc, "Continuă în browser|Continue in browser|Kontynuuj w przeglądarce")}</Link>
  </section></main>;
}
