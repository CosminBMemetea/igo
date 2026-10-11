// Querra Fleet: asistentul. Modelul (Groq) DOAR alege o funcție; cifrele și textul le construim aici din date.
import { fmtDate, fmtMoney, fmtNum, fmtPct, t, type Locale, type MsgKey } from "./i18n";
import { clientSummaries, monthSummary, tripViews, vehicleSummary } from "./query";
import type { AppAlert } from "./repo";
import type { Client, Trip, Vehicle } from "./fleet/seed";
import { whyText, ruleTitle, type RuleId } from "./fleet/rules";

export type ToolName = "month_totals" | "best_trip" | "vehicle_summary" | "alerts_summary" | "top_client";
export interface ToolCall { name: ToolName; args: { order?: "best" | "worst"; plate?: string } }
export const TOOLS = [
  { name: "month_totals", description: "Profit, number of trips/jobs, average profit per trip and fuel savings % vs baseline for the current month.", parameters: { type: "object", properties: {} } },
  { name: "best_trip", description: "The most (order=best) or least (order=worst) profitable trip or job this month.", parameters: { type: "object", properties: { order: { type: "string", enum: ["best", "worst"] } }, required: ["order"] } },
  { name: "vehicle_summary", description: "Profit, consumption and savings for one vehicle or machine, by plate or name.", parameters: { type: "object", properties: { plate: { type: "string" } }, required: ["plate"] } },
  { name: "alerts_summary", description: "Count of alerts, possible fuel theft, and the most important alert.", parameters: { type: "object", properties: {} } },
  { name: "top_client", description: "The most profitable client and overdue payments.", parameters: { type: "object", properties: {} } },
] as const;

export function parseToolCall(name: string, rawArgs: unknown): ToolCall | null {
  if (!TOOLS.some((x) => x.name === name)) return null;
  let a: Record<string, unknown> = {};
  try { a = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs as Record<string, unknown>) ?? {}; } catch { return null; }
  const order = a.order === "worst" ? "worst" : "best";
  const plate = typeof a.plate === "string" ? a.plate.slice(0, 40) : undefined;
  return { name: name as ToolName, args: { order, plate } };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** t() cu variabilele escapate (răspunsul se afișează ca HTML; doar șablonul nostru are <b>). */
const te = (loc: Locale, key: MsgKey, vars: Record<string, string | number> = {}) => t(loc, key, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v])));
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function detectLocale(q: string, fallback: Locale): Locale {
  const s = q.toLowerCase();
  if (/[ąćęłńóśźż]|który|jaki|ile |najbardziej|kurs\b/.test(s)) return "pl";
  if (/[ăâîșşțţ]|care |cât|cel mai|cursa|luna/.test(s)) return "ro";
  if (/\b(which|what|how|most|trip|month|show)\b/.test(s)) return "en";
  return fallback;
}
/** Rezervă fără AI: cuvinte-cheie în ro/en/pl. */
export function ruleIntent(q: string): ToolCall | null {
  const s = norm(q);
  const plate = s.match(/\b([a-z]{1,2})\s?(\d{2,3})\s?([a-z]{3})\b/);
  if (plate) return { name: "vehicle_summary", args: { plate: `${plate[1]} ${plate[2]} ${plate[3]}`.toUpperCase() } };
  const ALIAS: [RegExp, string][] = [[/(lexion|combin|kombajn)/, "lexion"], [/fendt/, "fendt"], [/(puma|case ih)/, "puma"]];
  for (const [re, n] of ALIAS) if (re.test(s)) return { name: "vehicle_summary", args: { plate: n } };
  if (/(alert|furt|theft|kradz|suspect|podejrz)/.test(s)) return { name: "alerts_summary", args: {} };
  if (/(client|klient|customer)/.test(s)) return { name: "top_client", args: {} };
  if (/(slab|pierdere|worst|loss|least|najslab|strat|najgorsz)/.test(s)) return { name: "best_trip", args: { order: "worst" } };
  if (/(profitabil|best|most profitable|cea mai buna|najlepsz|najbardziej zysk)/.test(s)) return { name: "best_trip", args: { order: "best" } };
  if (/(profit|econom|saving|oszczed|zysk|total|luna|month|miesiac|motorin|diesel|paliw)/.test(s)) return { name: "month_totals", args: {} };
  return null;
}

export interface AskData { vehicles: Vehicle[]; trips: Trip[]; clients: Client[]; alerts: AppAlert[] }
export interface Answer { html: string; tool: ToolName | null; source: "ai" | "rules" }
export function render(loc: Locale, d: AskData, call: ToolCall | null, source: Answer["source"]): Answer {
  const views = tripViews(d.trips, d.vehicles);
  const M = (n: number) => fmtMoney(loc, n);
  if (!call) return { html: t(loc, "ans.unknown"), tool: null, source };
  switch (call.name) {
    case "month_totals": {
      const m = monthSummary(views);
      return { html: te(loc, "ans.totals", { n: m.n, profit: M(m.profit), avg: M(m.avgProfit), pct: fmtPct(loc, m.savings.pct), lei: M(m.savings.savedLei) }), tool: call.name, source };
    }
    case "best_trip": {
      const done = views.filter((v) => !v.active).sort((a, b) => b.p.profit - a.p.profit);
      const x = call.args.order === "worst" ? done[done.length - 1] : done[0];
      return { html: te(loc, call.args.order === "worst" ? "ans.worst" : "ans.best", { title: x.title, plate: x.vehicle.name, date: fmtDate(loc, x.date), profit: M(x.p.profit), margin: fmtPct(loc, x.p.margin, 0) }), tool: call.name, source };
    }
    case "vehicle_summary": {
      const q = norm(call.args.plate ?? "").replace(/\s/g, "");
      const alias = /(combin|kombajn)/.test(q) ? "lexion" : q;
      const v = d.vehicles.find((x) => norm(x.name).replace(/\s/g, "").includes(alias) || x.id.includes(alias));
      if (!q || !v) return { html: t(loc, "ans.noVehicle"), tool: call.name, source };
      const s = vehicleSummary(v, views);
      const unit = v.per100 ? "L/100km" : "L/ha";
      return { html: te(loc, "ans.vehicle", { plate: v.name, n: s.n, profit: M(s.profit), rate: fmtNum(loc, s.actualRate, 1), unit, base: fmtNum(loc, v.baselineRate, 1), pct: (s.savings.pct >= 0 ? "−" : "+") + fmtPct(loc, Math.abs(s.savings.pct)) }), tool: call.name, source };
    }
    case "alerts_summary": {
      const a = d.alerts[0];
      const first = a ? `${a.rule.startsWith("loss") || a.rule === "agri-over" || a.rule === "doc-expiry" ? t(loc, `rule.${a.rule}` as MsgKey) : ruleTitle(loc, a.rule as RuleId)} (${d.vehicles.find((v) => v.id === a.vehicleId)?.name ?? "—"}) — ${a.rule === "loss" || a.rule === "agri-over" || a.rule === "doc-expiry" ? "" : whyText(loc, { rule: a.rule as RuleId, params: a.params })}` : "—";
      return { html: te(loc, "ans.alerts", { n: d.alerts.length, theft: d.alerts.filter((x) => x.theft).length, first: first.replace(/ — $/, "") }), tool: call.name, source };
    }
    case "top_client": {
      const c = clientSummaries(d.clients, views);
      return { html: te(loc, "ans.client", { name: c[0].client.name, profit: M(c[0].profit), n: c[0].n, overdue: M(c.reduce((s, x) => s + x.overdue, 0)) }), tool: call.name, source };
    }
  }
}
