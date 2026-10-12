// smoke:ask: rezerva pe reguli alege funcția corectă în ro/en/pl, iar răspunsul are cifre reale, fără placeholder-e.
import { detectLocale, parseToolCall, render, ruleIntent, type ToolName } from "../src/lib/ask";
import { demoRepo as repo } from "../src/lib/repo";
const r = repo();
const data = { vehicles: await r.vehicles(), trips: await r.trips(), clients: await r.clients(), alerts: await r.alerts() };
const cases: [string, ToolName, string][] = [
  ["Care a fost cea mai profitabilă cursă luna asta?", "best_trip", "ro"],
  ["Which was the most profitable trip this month?", "best_trip", "en"],
  ["Który kurs był najbardziej zyskowny w tym miesiącu?", "best_trip", "pl"],
  ["Cât profit și economie am în octombrie?", "month_totals", "ro"],
  ["How much diesel did we save this month?", "month_totals", "en"],
  ["Cât consumă BH 21 QRT?", "vehicle_summary", "ro"],
  ["How is CJ 08 QRT doing?", "vehicle_summary", "en"],
  ["Pokaż alerty kradzieży paliwa", "alerts_summary", "pl"],
  ["Care e cea mai slabă cursă?", "best_trip", "ro"],
  ["Cel mai bun client?", "top_client", "ro"],
];
let fail = 0;
for (const [q, tool, l] of cases) {
  const call = ruleIntent(q), loc = detectLocale(q, "ro");
  const a = render(loc, data, call, "rules");
  const good = call?.name === tool && loc === l && /\d/.test(a.html) && !/\{\w+\}|undefined|NaN/.test(a.html) && !/(find that|găsesc|znajduję)/.test(a.html);
  console.log(`${good ? "PASS" : "FAIL"} [${loc}] ${q} → ${call?.name} :: ${a.html.replace(/<[^>]+>/g, "").slice(0, 110)}`);
  if (!good) fail++;
}
const worst = ruleIntent("Care e cea mai slabă cursă?");
if (worst?.args.order !== "worst") { console.log("FAIL worst order"); fail++; }
if (parseToolCall("drop_tables", "{}") !== null || parseToolCall("best_trip", "not json") !== null) { console.log("FAIL parseToolCall acceptă input invalid"); fail++; }
const xss = render("ro", { ...data, trips: data.trips.map((t, i) => (i === 0 ? { ...t, title: "<img src=x onerror=alert(1)>", revenue: 999999 } : t)) }, { name: "best_trip", args: { order: "best" } }, "rules");
if (xss.html.includes("<img")) { console.log("FAIL HTML neescapat"); fail++; } else console.log("PASS HTML escapat");
if (fail) { console.error(`smoke:ask: ${fail} eșec(uri)`); process.exit(1); }
console.log("smoke:ask OK");
