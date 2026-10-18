import { LEGAL_CATEGORIES, EURO_CLASSES, PROPULSIONS, type VehicleCompliance } from "@/lib/compliance";
import { tri, type Locale } from "@/lib/i18n";
export function VehicleComplianceFields({ value, loc }: { value?: VehicleCompliance | null; loc: Locale }) {
  const tr = (s: string) => tri(loc, s), unknown = tr("Necunoscut|Unknown|Nieznane");
  const propulsion = { diesel: "Motorină|Diesel|Diesel", petrol: "Benzină|Petrol|Benzyna", hybrid: "Hibrid|Hybrid|Hybryda", electric: "Electric|Electric|Elektryczny", other: "Altă propulsie|Other|Inny" };
  return <fieldset className="compliance-fields"><legend>{tr("Date din talon · documente și taxe|Registration details · documents and tolls|Dane rejestracyjne · dokumenty i opłaty")}</legend>
    <p className="hint">{tr("Copiază datele din talon. MTMA este masa maximă autorizată, nu marfa încărcată. Lasă necunoscut ce nu poți confirma.|Copy the registration details. MTMA is the maximum authorised mass, not the load. Leave unconfirmed values unknown.|Przepisz dane z dowodu. DMC to masa dopuszczalna, nie ładunek. Niepotwierdzone dane pozostaw nieznane.")}</p>
    <div className="two">
      <label className="lf"><span>{tr("Categoria · J|Category · J|Kategoria · J")}</span><select name="category" defaultValue={value?.category ?? ""}><option value="">{unknown}</option>{LEGAL_CATEGORIES.map(c => <option key={c} value={c}>{c === "other" ? tr("Altă categorie / vehicul special|Other / special vehicle|Inna / pojazd specjalny") : c}</option>)}</select></label>
      <label className="lf"><span>{tr("MTMA · kg · F.2|MTMA · kg · F.2|DMC · kg · F.2")}</span><input name="mtmaKg" type="number" min="1" max="200000" step="1" placeholder="18000" defaultValue={value?.mtmaKg ?? ""} /></label>
      <label className="lf"><span>{tr("Locuri, inclusiv șofer · S.1|Seats including driver · S.1|Miejsca z kierowcą · S.1")}</span><input name="seats" type="number" min="1" max="200" step="1" defaultValue={value?.seats ?? ""} /></label>
      <label className="lf"><span>{tr("Norma EURO|EURO class|Norma EURO")}</span><select name="euro" defaultValue={value?.euro ?? ""}><option value="">{unknown}</option>{EURO_CLASSES.map(c => <option key={c} value={c}>EURO {c}</option>)}</select></label>
      <label className="lf"><span>{tr("Propulsie|Propulsion|Napęd")}</span><select name="propulsion" defaultValue={value?.propulsion ?? ""}><option value="">{unknown}</option>{PROPULSIONS.map(c => <option key={c} value={c}>{tr(propulsion[c])}</option>)}</select></label>
      <label className="lf"><span>{tr("Țara înmatriculării · cod|Registration country · code|Kraj rejestracji · kod")}</span><input name="country" maxLength={2} minLength={2} pattern="[A-Za-z]{2}" autoCapitalize="characters" placeholder="RO" defaultValue={value?.country ?? ""} /></label>
    </div>
  </fieldset>;
}
