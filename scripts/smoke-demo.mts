import { carryDemoWork, demoWorkMs } from "../src/lib/demo-work";
// smoke:demo: demo-ul are o singură sursă de adevăr (Acasă = Curse = Clienți = Bonuri = Economii),
// date relative la azi (nimic din viitor), exact 3 alerte credibile și niciun „simulat” în interfață.
import { DemoRepository } from "../src/lib/repo";
import { clientSummaries, demoReceipts, monthSummary, tripViews, liveFleet, fullPath } from "../src/lib/query";
import { economii } from "../src/lib/economii";
import { realToday, shiftStr, demoDelta } from "../src/lib/demo-time";
import { TRUCKS, CITY_CC, DEMO_NOW_MIN, dayPlan, positionAt, routeTotalKm, haversineKm, levelSeries, kmAt, FILLS } from "../src/lib/fleet/data";
import { demoReplay } from "../src/lib/replay";
import { buildFeed } from "../src/lib/feed";
import { rankings } from "../src/lib/ranking";
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

// Șapte echipaje reale în scenariu, cu o singură rută comună hărții și curselor.
ok("exact 7 camioane și 7 șoferi distincți", vehicles.length === 7 && TRUCKS.length === 7 && new Set(vehicles.map((v) => v.driver)).size === 7);
ok("fiecare cursă are camion și client valabile", trips.every((t) => vehicles.some((v) => v.id === t.vehicleId) && clients.some((c) => c.id === t.clientId)));
ok("exact o cursă de azi per camion", vehicles.every((v) => trips.filter((t) => t.vehicleId === v.id && t.active && t.date === today).length === 1));
const countries = new Set(TRUCKS.flatMap((t) => t.route.map((w) => CITY_CC[w.name] ?? "RO")));
ok("rutele traversează cel puțin 12 țări", countries.size >= 12, [...countries].join(", "));
const live = liveFleet(vehicles, views, [], [], DEMO_NOW_MIN, new Set());
ok("toate cele 7 camioane au poziții distincte", live.length === 7 && live.every((v) => v.at) && new Set(live.map((v) => v.at?.join(","))).size === 7);
ok("poziții răspândite în Europa, vest și est", Math.min(...live.map((v) => v.at![1])) < 10 && Math.max(...live.map((v) => v.at![1])) > 24);
for (const truck of TRUCKS) {
  const plan = dayPlan(truck), total = routeTotalKm(truck), view = views.find((v) => v.vehicleId === truck.id && v.active)!;
  const end = plan.find((p) => p.kind === "stop" && p.kmStart > 0)!.start;
  ok(`${truck.plate}: km cursă = km hartă, fără retur ascuns`, Math.abs(view.km - total) <= 1);
  ok(`${truck.plate}: la final ajunge la destinație`, haversineKm(positionAt(truck, end).at, truck.route[truck.route.length - 1].at) < 1);
  let driving = 0, longest = 0;
  for (const p of plan) { if (p.kind === "drive") { driving += p.end - p.start; longest = Math.max(longest, driving); } if (p.kind === "break" && p.end - p.start >= 45) driving = 0; }
  ok(`${truck.plate}: pauze și distanțe plauzibile`, truck.depMin >= 0 && longest <= 270.01 && total >= 300 && total <= 600);
  ok(`${truck.plate}: rezervor în limite`, (levelSeries(truck) ?? []).every((p) => p.levelL >= 0 && p.levelL <= truck.tankL));
  const replay = demoReplay(truck.id, "2026-10-15", view.id)!;
  ok(`${truck.plate}: replay fără viitor, aceeași poziție finală`, replay.keys.every((p) => p[0] <= DEMO_NOW_MIN) && replay.events.every((e) => e.min <= DEMO_NOW_MIN && (e.end ?? 0) <= DEMO_NOW_MIN) && Math.abs(replay.km - kmAt(truck, DEMO_NOW_MIN)) < 1);
  const back = fullPath(truck.id, truck.routeName.split(" → ").reverse().join(" → "));
  ok(`${truck.plate}: returul începe din capătul corect`, haversineKm(back[0], truck.route[truck.route.length - 1].at) < 1);
}
const privateFleet = liveFleet(vehicles, views, [], [], DEMO_NOW_MIN, new Set([TRUCKS[0].id]));
ok("pauză privată: fără poziție, istoric sau traseu", privateFleet[0].at === null && privateFleet[0].track.length === 0 && privateFleet[0].ahead.length === 0 && privateFleet[0].done.length === 0);
ok("bonurile zilei nu vin din viitor", FILLS.filter((f) => f.time.startsWith("2026-10-15")).every((f) => f.time.slice(11, 16) <= "14:00"));
const feed = buildFeed({ loc: "ro", vehicles, views, clients, alerts, live, drivers: rankings(vehicles, views, alerts, today, true).drivers });
ok("flux: 7 povești și evenimente legate de flota curentă", feed.stories.length === 7 && feed.events.every((e) => vehicles.some((v) => v.id === e.vehicleId)));

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
ok("cursele viitoare sunt planificate și neîncepute", trips.some(t => t.date > today) && trips.filter(t => t.date > today).every(t => t.planned && !t.loadedAt && !t.deliveredAt));
ok("cursele în desfășurare sunt de azi", trips.filter((t) => t.active && t.loadedAt).every((t) => t.date === today) && trips.some((t) => t.active && t.loadedAt));
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

// Retain work through stop/start/reload and exclude a private pause.
const workNow = Date.parse("2026-10-15T12:00:00Z");
const workSeed = { vehicleId: "test", start: new Date(workNow - 2 * 3600000).toISOString(), end: null, privateSince: null, checklist: [] };
const stoppedWork = carryDemoWork({ ...workSeed, end: new Date(workNow).toISOString() }, workSeed, workNow);
const restartedWork = carryDemoWork({ ...workSeed, start: new Date(workNow + 60000).toISOString() }, stoppedWork, workNow + 60000);
ok("demo ore: stop/start/reload păstrează turele anterioare", demoWorkMs(JSON.parse(JSON.stringify(restartedWork)), workNow + 120000) === 2 * 3600000 + 60000);
const privateWork = carryDemoWork({ ...restartedWork, privateSince: new Date(workNow + 120000).toISOString() }, restartedWork, workNow + 120000);
ok("demo ore: pauza privată nu crește totalul la reload", demoWorkMs(privateWork, workNow + 3600000) === 2 * 3600000 + 60000);
const resumedWork = carryDemoWork({ ...privateWork, privateSince: null }, privateWork, workNow + 3600000);
ok("demo ore: revenirea din pauză reia totalul corect", demoWorkMs(resumedWork, workNow + 3660000) === 2 * 3600000 + 120000);

if (fail) { console.error(`\n${fail} verificări eșuate`); process.exit(1); }
console.log("\nsmoke:demo OK");
