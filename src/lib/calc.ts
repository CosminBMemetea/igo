// Querra Fleet: formulele de bază. Pure, fără I/O; testate în scripts/smoke-calc.mts.
// Vezi CONCEPT.md §4.

export interface TripCosts {
  revenue: number;      // lei
  litres: number;       // L atribuiți cursei/lucrării
  fuelPrice: number;    // lei/L (prețul de pe card)
  tolls: number;        // lei
  driver: number;       // lei (ore × cost orar sau zile × (diurnă + salariu/zi))
  other: number;        // lei (uzură/km sau /ha, AdBlue, parcări)
}
export interface ProfitBreakdown { revenue: number; fuel: number; tolls: number; driver: number; other: number; fixed?: number; costs: number; profit: number; margin: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Profit = Venit − Motorină − Taxe drum − Șofer − Alte costuri; Marjă = Profit / Venit. */
export function tripProfit(c: TripCosts): ProfitBreakdown {
  const fuel = r2(c.litres * c.fuelPrice);
  const costs = r2(fuel + c.tolls + c.driver + c.other);
  const profit = r2(c.revenue - costs);
  return { revenue: c.revenue, fuel, tolls: c.tolls, driver: c.driver, other: c.other, costs, profit, margin: c.revenue ? profit / c.revenue : 0 };
}

/** Litri pe cursă când nu există consum măsurat: km × consum real / 100 (sau h × L/h, ha × L/ha). */
export const litresFromRate = (units: number, rate: number, per100 = true) => (per100 ? (units * rate) / 100 : units * rate);

export interface Savings { baselineLitres: number; actualLitres: number; savedLitres: number; savedLei: number; pct: number }
/**
 * Economie față de bază, la PREȚUL ACTUAL pentru ambele consumuri (scumpirea/ieftinirea motorinei nu contează).
 * rate-urile sunt în L/100km (per100=true) sau L/h, L/ha (per100=false).
 * pct = (Bază − Actual) / Bază.
 */
export function savings(units: number, baselineRate: number, actualRate: number, price: number, per100 = true): Savings {
  const baselineLitres = litresFromRate(units, baselineRate, per100);
  const actualLitres = litresFromRate(units, actualRate, per100);
  const savedLitres = baselineLitres - actualLitres;
  return { baselineLitres, actualLitres, savedLitres, savedLei: r2(savedLitres * price), pct: baselineRate ? (baselineRate - actualRate) / baselineRate : 0 };
}

/** Agregare pe flotă: suma litrilor de bază vs suma litrilor reali. */
export function sumSavings(items: Savings[]): Savings {
  const b = items.reduce((s, x) => s + x.baselineLitres, 0), a = items.reduce((s, x) => s + x.actualLitres, 0), lei = items.reduce((s, x) => s + x.savedLei, 0);
  return { baselineLitres: b, actualLitres: a, savedLitres: b - a, savedLei: r2(lei), pct: b ? (b - a) / b : 0 };
}

/** Pragul minim ca economia să fie afișată (altfel „date insuficiente”). */
export const MIN_KM = 1000, MIN_HOURS = 20;
export const enoughData = (km: number, hours: number) => km >= MIN_KM || hours >= MIN_HOURS;
