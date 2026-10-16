import type { CardRow } from "../store/types";
import { isDate, normPlate } from "../validate";

export const LEGACY_CARD_FROM = "0001-01-01T00:00";
/** Local wall time, exactly as in the provider CSV; no browser/server timezone conversion. */
export const validCardTime = (value: string) => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && value.slice(0, 4) >= "2000" && isDate(value.slice(0, 10));
export const normalizeCard = (value: string) => value.replace(/[\s-]/g, "").replace(/^'/, "");
export const validCardId = (value: string) => !!value && value === normalizeCard(value) && value.length <= 40 && !/[\u0000-\u001f\u007f]/.test(value);
export const plateKey = (value: string | null) => value ? (normPlate(value) ?? value).replace(/\s/g, "").toUpperCase() : "";
export function cardAt(cards: CardRow[], card: string, at: string): CardRow | undefined {
  return cards.filter((c) => c.card === card && c.validFrom <= at).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
}
