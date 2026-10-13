/** Suma în lei a unei alimentări: convertită la import (curs BCE) sau originală dacă e deja în lei; altfel null. */
export const isRon = (c: string | null | undefined) => !c || /^(RON|LEI|LEU)$/i.test(c.trim());
export const leiOf = (x: { amount: number | null; currency: string | null; amountRon?: number | null }) => x.amountRon ?? (x.amount != null && isRon(x.currency) ? x.amount : null);
