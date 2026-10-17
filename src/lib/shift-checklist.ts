export const SHIFT_CHECKS = ["chk.tyres", "chk.fluids", "chk.docs", "chk.damage"] as const;
export function validShiftChecklist(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 3 && value.length <= SHIFT_CHECKS.length
    && new Set(value).size === value.length
    && value.every(x => typeof x === "string" && (SHIFT_CHECKS as readonly string[]).includes(x));
}
