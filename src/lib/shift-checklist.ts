export const SHIFT_CHECKS = ["chk.tyres", "chk.fluids", "chk.docs", "chk.damage"] as const;
/** Tura pornește cu cel puțin 3 din 4 bife; „gata ✓” se afișează doar la 4/4. */
export const MIN_SHIFT_CHECKS = 3;
export function validShiftChecklist(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= MIN_SHIFT_CHECKS && value.length <= SHIFT_CHECKS.length
    && new Set(value).size === value.length
    && value.every(x => typeof x === "string" && (SHIFT_CHECKS as readonly string[]).includes(x));
}
export function checklistLabel(loc: "ro" | "en" | "pl", done: number) {
  const n = Math.min(done, SHIFT_CHECKS.length), all = SHIFT_CHECKS.length;
  const pick = (ro: string, en: string, pl: string) => loc === "en" ? en : loc === "pl" ? pl : ro;
  if (n >= all) return pick("Verificare gata ✓", "Check done ✓", "Kontrola gotowa ✓");
  if (n >= MIN_SHIFT_CHECKS) return pick(`Verificare ${n}/${all} · poți porni`, `Check ${n}/${all} · you can start`, `Kontrola ${n}/${all} · można zacząć`);
  return pick(`Verificare ${n}/${all}`, `Check ${n}/${all}`, `Kontrola ${n}/${all}`);
}
