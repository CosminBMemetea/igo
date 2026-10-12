/** Alege forma de plural din „unu|câțiva|mulți” (ro: 1 cursă, 2 curse, 20 de curse). Fără dicționare: merge și în client. */
export function pluralForm(loc: string, n: number, forms: string): string {
  const [one, few, many = few] = forms.split("|");
  const a = Math.abs(n), m100 = a % 100, m10 = a % 10;
  return a === 1 ? one : loc === "ro" ? (a === 0 || (m100 >= 1 && m100 <= 19) ? few : many) : loc === "pl" ? (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? few : many) : few;
}
