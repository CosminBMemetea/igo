// smoke:calc: formulele de profit pe cursă și economie % (CONCEPT.md §4), pe valori calculate de mână.
import { tripProfit, savings, sumSavings, enoughData } from "../src/lib/calc";
import { TRIPS, VEHICLES } from "../src/lib/fleet/seed";
import { monthSummary, tripViews } from "../src/lib/query";
let fail = 0;
const eq = (name: string, got: number, want: number, eps = 0.01) => { const ok = Math.abs(got - want) <= eps; console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${got} (aștept ${want})`); if (!ok) fail++; };
const ok = (name: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"} ${name}`); if (!c) fail++; };

// Oradea → Viena: 5.200 − 172×7,30 − 1.050 − 900 − 325
const p = tripProfit({ revenue: 5200, litres: 172, fuelPrice: 7.3, tolls: 1050, driver: 900, other: 325 });
eq("motorină", p.fuel, 1255.6); eq("costuri", p.costs, 3530.6); eq("profit", p.profit, 1669.4); eq("marjă", p.margin, 0.32104, 0.0001);
// cursă pe pierdere
const loss = tripProfit({ revenue: 1000, litres: 100, fuelPrice: 7.3, tolls: 200, driver: 300, other: 100 });
eq("profit negativ", loss.profit, -330); ok("marjă negativă", loss.margin < 0);
eq("venit 0 → marjă 0", tripProfit({ revenue: 0, litres: 0, fuelPrice: 7, tolls: 0, driver: 0, other: 0 }).margin, 0);
// economie camion: 590 km, bază 32,0 → 29,1 L/100km
const s = savings(590, 32.0, 29.1, 7.3);
eq("economie %", s.pct, 0.090625, 1e-6); eq("litri economisiți", s.savedLitres, 17.11); eq("lei economisiți", s.savedLei, 124.9);
// economie utilaj: 838 ha, bază 19,2 → 16,8 L/ha
const a = savings(838, 19.2, 16.8, 7.3, false);
eq("utilaj %", a.pct, 0.125, 1e-9); eq("utilaj litri", a.savedLitres, 2011.2); eq("utilaj lei", a.savedLei, 14681.76);
// consum mai mare decât baza → economie negativă
ok("peste bază → negativ", savings(100, 30, 33, 7).pct < 0);
// prețul nu schimbă procentul (aceeași cantitate, preț diferit)
eq("% independent de preț", savings(590, 32, 29.1, 9.9).pct, s.pct, 1e-12);
const sum = sumSavings([s, a]);
eq("agregare %", sum.pct, (s.savedLitres + a.savedLitres) / (s.baselineLitres + a.baselineLitres), 1e-12);
ok("prag date", !enoughData(500, 5) && enoughData(1200, 0) && enoughData(0, 25));
// date demo coerente
const m = monthSummary(tripViews(TRIPS, VEHICLES));
ok(`lună demo: economie ${(m.savings.pct * 100).toFixed(1)}% în 5–20%`, m.savings.pct > 0.05 && m.savings.pct < 0.2);
ok(`lună demo: profit mediu ${Math.round(m.avgProfit)} > 0`, m.avgProfit > 0);
ok("lună demo: există cursă pe pierdere", tripViews(TRIPS, VEHICLES).some((v) => v.p.profit < 0));
ok("fiecare cursă are vehicul", TRIPS.every((t) => VEHICLES.some((v) => v.id === t.vehicleId)));
if (fail) { console.error(`smoke:calc: ${fail} eșec(uri)`); process.exit(1); }
console.log("smoke:calc OK");
