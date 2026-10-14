import { fmtDate, fmtMoney, fmtNum, t, type Locale, type MsgKey } from "./i18n";
import { ruleTitle, whyText, type RuleId } from "./fleet/rules";
import type { AppAlert } from "./repo";

const BIZ = new Set(["loss", "agri-over", "doc-expiry", "gps-privat"]);
export function alertTitle(loc: Locale, a: Pick<AppAlert, "rule">) {
  return BIZ.has(a.rule) ? t(loc, `rule.${a.rule}` as MsgKey) : ruleTitle(loc, a.rule as RuleId);
}
export function alertWhy(loc: Locale, a: Pick<AppAlert, "rule" | "params">): string {
  const p = a.params;
  if (a.rule === "loss") {
    const topKey = ({ tolls: "trip.tolls", other: "trip.other", fuel: "trip.fuel", driver: "trip.driver" } as const)[p.top as "tolls"];
    return t(loc, "why.loss", { title: p.title, plate: p.plate, date: fmtDate(loc, String(p.date)), revenue: fmtMoney(loc, +p.revenue), costs: fmtMoney(loc, +p.costs), profit: fmtMoney(loc, +p.profit), top: t(loc, topKey).toLowerCase() });
  }
  if (a.rule === "agri-over") return t(loc, "why.agri-over", { plate: p.plate, parcel: p.parcel, lha: fmtNum(loc, +p.lha, 1), base: fmtNum(loc, +p.base, 1), pct: p.pct });
  if (a.rule === "doc-expiry") { const dd = Number(p.days), v = { doc: t(loc, `doc.${p.doc}` as MsgKey), owner: p.owner, date: fmtDate(loc, String(p.date), true), days: Math.abs(dd) }; return t(loc, dd < 0 ? "why.doc-expired" : dd === 0 ? "why.doc-today" : "why.doc-expiry", v); }
  if (a.rule === "gps-privat") return t(loc, "why.gps-privat", { plate: p.plate, station: p.station, litres: fmtNum(loc, +p.litres), time: String(p.time).slice(11, 16) });
  return whyText(loc, { rule: a.rule as RuleId, params: p });
}
