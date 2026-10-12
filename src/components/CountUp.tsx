import { fmtNum, type Locale } from "@/lib/i18n";
/** Număr KPI: valoarea finală, fixă (fără animație: capturile și reîncărcările arată mereu aceeași cifră). */
export function CountUp({ value, loc, d = 0 }: { value: number; loc: Locale; d?: number }) {
  return <span>{fmtNum(loc, value, d)}</span>;
}
