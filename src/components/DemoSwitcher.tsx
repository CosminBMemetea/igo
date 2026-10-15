import { tri, type Locale } from "@/lib/i18n";

export function DemoSwitcher({ loc, driver = false }: { loc: Locale; driver?: boolean }) {
  return <aside className="demo-switcher" aria-label={tri(loc, "Mod demo|Demo mode|Tryb demo")}>
    <p>{tri(loc, "Demo cu date fictive. Poți schimba rolul fără să pierzi tura și bonurile de test.|Sample-data demo. Switch roles while keeping your test shift and receipts.|Demo z fikcyjnymi danymi. Zmień rolę bez utraty zmiany i paragonów testowych.")}</p>
    <div className="demo-switcher-actions">
      <form action="/api/auth/demo" method="post"><input type="hidden" name="as" value={driver ? "owner" : "driver"} /><button className="btn sec sm">{tri(loc, driver ? "Vezi ca patron|View as owner|Widok właściciela" : "Încearcă drept șofer|Try as driver|Wypróbuj jako kierowca")}</button></form>
      <details><summary>{tri(loc, "Reia demo-ul|Restart demo|Uruchom demo ponownie")}</summary><p className="hint">{tri(loc, "Șterge tura, pauza și bonurile de test din acest browser.|Clears the test shift, break and receipts in this browser.|Usuwa testową zmianę, przerwę i paragony w tej przeglądarce.")}</p><form action="/api/auth/demo" method="post"><input type="hidden" name="as" value={driver ? "driver" : "owner"} /><input type="hidden" name="reset" value="1" /><button className="btn sec sm">{tri(loc, "Pornește un demo nou|Start a new demo|Rozpocznij nowe demo")}</button></form></details>
    </div>
  </aside>;
}
