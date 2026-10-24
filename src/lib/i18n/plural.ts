/** Forme de plural cu Intl.PluralRules (CLDR), aceleași pe server și în browser; fără dicționare, merge și în client.
 *  `forms` = „unu|câțiva|mulți” (ro: 1 cursă · 2 curse · 20 de curse; pl: 1 kurs · 2 kursy · 5 kursów; en: 1 trip · 2 trips). */
const RULES = new Map<string, Intl.PluralRules>();
export function pluralCategory(loc: string, n: number): Intl.LDMLPluralRule {
  let r = RULES.get(loc);
  if (!r) RULES.set(loc, (r = new Intl.PluralRules(loc)));
  return r.select(n);
}
export function pluralForm(loc: string, n: number, forms: string): string {
  const [one, few = one, many = few] = forms.split("|");
  const c = pluralCategory(loc, n);
  return c === "one" ? one : c === "few" ? few : c === "many" ? many : loc === "ro" ? many : few; // ro „other” = 20+ („de”); pl „other” = fracții → forma 2 (1,5 kursu ≈ kursy); en „other” = plural
}
