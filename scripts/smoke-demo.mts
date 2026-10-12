// smoke:demo: demo-ul are o singură sursă de adevăr (Acasă = Curse = Clienți = Bonuri = Economii),
// date relative la azi (nimic din viitor), exact 3 alerte credibile și niciun „simulat” în interfață.
import { DemoRepository } from "../src/lib/repo";
import { clientSummaries, demoReceipts, monthSummary, tripViews } from "../src/lib/query";
import { economii } from "../src/lib/economii";
import { realToday, shiftStr, demoDelta } from "../src/lib/demo-time";
import { CATALOGS } from "../src/lib/i18n";
let fail = 0;
const ok = (name: string, c: boolean, info = "") => { console.log(`${c ? "PASS" : "FAIL"} ${name}${info ? ` (${info})` : ""}`); if (!c) fail++; };
const near = (a: number, b: number, eps = 1) => Math.abs(a - b) <= eps;

const r = new DemoRepository();
const [vehicles, trips, clients, alerts, docs] = await Promise.all([r.vehicles(), r.trips(), r.clients(), r.alerts(), r.docs()]);
const views = tripViews(trips, vehicles);
const m = monthSummary(views);
const cs = clientSummaries(clients, views);
const rc = demoReceipts(views);
const e = economii(views, alerts, vehicles, 15);
const today = realToday();

// 1. totaluri identice între pagini
ok("clienți: profit = Acasă", near(cs.reduce((s, c) => s + c.profit, 0), m.profit), `${Math.round(cs.reduce((s, c) => s + c.profit, 0))} vs ${Math.round(m.profit)}`);
ok("clienți: nr. curse = Acasă", cs.reduce((s, c) => s + c.n, 0) === m.n, `${cs.reduce((s, c) => s + c.n, 0)} vs ${m.n}`);
ok("clienți: venit = Acasă", near(cs.reduce((s, c) => s + c.revenue, 0), m.revenue));
ok("bonuri: lei motorină = costul motorinei din curse", near(rc.reduce((s, x) => s + x.amount, 0), m.fuelLei), `${Math.round(rc.reduce((s, x) => s + x.amount, 0))} vs ${Math.round(m.fuelLei)}`);
ok("bonuri: litri = litrii din curse", near(rc.reduce((s, x) => s + x.litres, 0), m.litres));
ok("bonuri: un bon pe cursă încheiată", rc.length === m.n);
ok("economii măsurate = economia de pe Acasă", near(e.lines.fuel, m.savings.savedLei), `${e.lines.fuel} vs ${Math.round(m.savings.savedLei)}`);
ok("profit Acasă = Σ curse încheiate", near(views.filter((v) => !v.active).reduce((s, v) => s + v.p.profit, 0), m.profit));

// 2. date relative la azi
ok("nicio cursă din viitor", trips.every((t) => t.date <= today), today);
ok("cursele în desfășurare sunt de azi", trips.filter((t) => t.active).every((t) => t.date === today) && trips.some((t) => t.active));
ok("alertele nu sunt din viitor (în afară de expirări)", alerts.filter((a) => a.rule !== "doc-expiry").every((a) => a.time.slice(0, 10) <= today));
ok("documentele care expiră sunt în viitor", docs.filter((d) => d.expires).every((d) => d.expires! >= today));
ok("shiftStr", shiftStr("2026-10-15T12:00", -3) === "2026-10-12T12:00" && demoDelta("2026-10-15") === 0);

// 3. exact 3 alerte credibile
ok("3 alerte", alerts.length === 3, String(alerts.length));
ok("o alimentare suspectă", alerts.filter((a) => a.theft).length === 1);
ok("un document care expiră", alerts.filter((a) => a.rule === "doc-expiry").length === 1);
ok("un consum peste normal", alerts.filter((a) => a.rule === "consum-peste-normal").length === 1);

// 4. fără „simulat” în texte
for (const [loc, cat] of Object.entries(CATALOGS)) ok(`fără „simulat” (${loc})`, !Object.values(cat).some((v) => /simulat|simulated|symulowan/i.test(v)));

if (fail) { console.error(`\n${fail} verificări eșuate`); process.exit(1); }
console.log("\nsmoke:demo OK");
