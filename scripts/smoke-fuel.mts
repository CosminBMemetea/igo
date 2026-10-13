// smoke:fuel — parsere pe fiecare fișier de exemplu, numere/date RO/PL/EN, fiecare regulă, deduplicare și izolarea între firme (Postgres).
import fs from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { autoMap, dateOrder, decimalSep, parseDateTime, parseFuelCsv, parseNum, type Source } from "../src/lib/fuel/parse";
import { firmFuelAlerts, fillToFill, type FirmRule, type RTruck, type RTx } from "../src/lib/fuel/rules";
import { whyText } from "../src/lib/fleet/rules";
let fail = 0;
const ok = (n: string, c: boolean, x = "") => { console.log(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : " " + x}`); if (!c) fail++; };

// 1. parsere
const EXP: [string, Source, number][] = [["dkv", "dkv", 39], ["omv-routex", "omv", 39], ["mol", "mol", 39], ["shell", "shell", 39], ["e100", "e100", 39], ["generic", "generic", 40]];
for (const [file, src, n] of EXP) {
  const r = parseFuelCsv(fs.readFileSync(`public/samples/${file}.csv`, "utf8"));
  const f = r.rows[0];
  ok(`${file}: format ${src}, ${n} rânduri, prima alimentare corectă`, r.source === src && r.confident && r.rows.length === n && f.at === "2026-09-01T17:40" && f.litres === 258.04 && f.amount === 1961.1 && f.odometer === 413189 && f.plate === "BH 21 QRT", JSON.stringify({ s: r.source, c: r.confident, n: r.rows.length, f }));
}
const gen = parseFuelCsv("Data;Litri;Card\n05.10.2026 22:15;310,5;7034 1111\n");
ok("format necunoscut → generic, coloane auto", gen.source === "generic" && gen.rows[0]?.litres === 310.5 && gen.rows[0]?.card === "70341111");
const bad = parseFuelCsv("foo,bar,baz\n1,2,3\n");
ok("fără coloane obligatorii → cere mapare", !bad.confident && bad.missing.includes("date") && bad.rows.length === 0);
const mapped = parseFuelCsv("foo,bar,baz\n2026-10-01,12.5,CARD1\n", { date: 0, litres: 1, card: 2 });
ok("mapare manuală", mapped.rows[0]?.litres === 12.5 && mapped.rows[0]?.card === "CARD1");
ok("autoMap RO", autoMap(["Data tranzacției", "Nr. înmatriculare", "Cantitate (l)"]).plate === 1);
// numere și date
ok("numere RO 1.234,56", parseNum("1.234,56", decimalSep(["1.234,56"], ";")) === 1234.56);
ok("numere PL 1 234,56", parseNum("1 234,56", decimalSep(["1 234,56", "12,5"], ";")) === 1234.56);
ok("numere EN 1,234.56", parseNum("1,234.56", decimalSep(["1,234.56"], ",")) === 1234.56);
ok("mii fără zecimale: 413,189 (EN) și 413.189 (RO)", parseNum("413,189", decimalSep(["413,189", "414,187"], ",")) === 413189 && parseNum("413.189", decimalSep(["413.189"], ";")) === 413189);
ok("date: zi întâi (31/12)", parseDateTime("31/12/2026 23:05", undefined, dateOrder(["31/12/2026"])) === "2026-12-31T23:05");
ok("date: lună întâi (12/31) + PM", parseDateTime("12/31/2026", "11:05 PM", dateOrder(["12/31/2026"])) === "2026-12-31T23:05");
ok("date ISO + oră separată", parseDateTime("2026-10-01", "7:05", "ymd") === "2026-10-01T07:05");
ok("dată invalidă respinsă", parseDateTime("31.02.2026", undefined, "dmy") === null);

// 2. reguli
const tr: RTruck = { id: "t1", plate: "BH 21 QRT", tankL: 600, normalL100: 30, baseline: null };
let k = 0;
const tx = (at: string, litres: number, odometer: number | null, extra: Partial<RTx> = {}): RTx => ({ id: `x${++k}`, truckId: "t1", at, litres, odometer, station: "OMV Oradea", card: "C1", lat: null, lng: null, ...extra });
const fires = (name: FirmRule, list: RTx[], pos: { truckId: string; at: string; lat: number; lng: number }[] = []) => {
  const a = firmFuelAlerts([tr], list, pos);
  const hit = a.find((x) => x.rule === name);
  ok(`regula ${name} se declanșează, cu „De ce” în ro/en/pl`, !!hit && ["ro", "en", "pl"].every((l) => !whyText(l as "ro", { rule: hit.rule, params: hit.params }).includes("{")), JSON.stringify(a.map((x) => x.rule)));
};
fires("peste-capacitate", [tx("2026-10-05T10:00", 640, 1000)]);
fires("l100-mare", [tx("2026-10-05T10:00", 300, 100000), tx("2026-10-07T10:00", 400, 101000)]); // 40 L/100km vs 30
fires("consum-peste-normal", [tx("2026-10-05T10:00", 300, 100000), tx("2026-10-07T10:00", 360, 101000)]); // 36 vs 30 (+20%)
fires("odo-inapoi", [tx("2026-10-05T10:00", 300, 100000), tx("2026-10-07T10:00", 300, 99000)]);
fires("odo-salt", [tx("2026-10-05T10:00", 300, 100000), tx("2026-10-05T14:00", 300, 101500)]);
fires("dubla", [tx("2026-10-05T10:00", 350, 100000), tx("2026-10-05T10:40", 320, 100010)]);
fires("noapte", [tx("2026-10-06T23:30", 200, 100000)]);
fires("weekend", [tx("2026-10-10T11:00", 200, 100000)]);
fires("card-fara-camion", [tx("2026-10-06T10:00", 200, 100000, { lat: 47.05, lng: 21.92 })], [{ truckId: "t1", at: "2026-10-06T10:10", lat: 46.77, lng: 23.62 }]);
const clean = parseFuelCsv(fs.readFileSync("public/samples/dkv.csv", "utf8")).rows.filter((r) => r.plate === "BH 21 QRT").map((r, i) => ({ id: `c${i}`, truckId: "t1", at: r.at, litres: r.litres, odometer: r.odometer, station: r.station, card: r.card, lat: null, lng: null }));
const cleanAlerts = firmFuelAlerts([{ ...tr, normalL100: 29.5 }], clean).filter((a) => a.theft);
ok("fișierul de exemplu (fără anomalii) nu dă alerte de furt", cleanAlerts.length === 0, JSON.stringify(cleanAlerts.map((a) => a.rule)));
{
  const all = [...parseFuelCsv(fs.readFileSync("public/samples/dkv.csv", "utf8")).rows, ...parseFuelCsv(fs.readFileSync("public/samples/anomalii.csv", "utf8")).rows].filter((r) => r.plate).map((r, i) => ({ id: `y${i}`, truckId: r.plate === "BH 21 QRT" ? "t1" : "t2", at: r.at, litres: r.litres, odometer: r.odometer, station: r.station, card: r.card, lat: null, lng: null }));
  const got = new Set(firmFuelAlerts([{ ...tr, normalL100: 29.5 }, { id: "t2", plate: "CJ 08 QRT", tankL: 700, normalL100: 31, baseline: null }], all).filter((a) => a.time >= "2026-10-20").map((a) => a.rule));
  ok("exemplul cu anomalii (după DKV): capacitate, L/100km, dublă, noapte, kilometraj înapoi", ["peste-capacitate", "l100-mare", "dubla", "noapte", "odo-inapoi"].every((r) => got.has(r as FirmRule)), [...got].join(","));
}
const ftf = fillToFill(clean);
ok("baza plin-la-plin din istoric ≈ 29,5 L/100km", ftf.l100 != null && Math.abs(ftf.l100 - 29.5) < 1, String(ftf.l100));

// 3. Postgres: deduplicare + izolare
const URL_DB = process.env.TEST_DATABASE_URL;
if (!URL_DB) console.log("smoke:fuel: TEST_DATABASE_URL lipsește, sar peste partea Postgres");
else {
  const pool = new pg.Pool({ connectionString: URL_DB, max: 2 });
  await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  const schema = await import("../src/db/schema");
  const { PgStore } = await import("../src/lib/store/pg");
  const { commit, analyze } = await import("../src/lib/fuel/import");
  const s = new PgStore(drizzle(pool, { schema }) as never);
  const A = await s.createFirm({ name: "A", cui: null }), B = await s.createFirm({ name: "B", cui: null });
  const a1 = await s.addTruck(A.id, { plate: "BH 21 QRT", vin: null, model: null, tankL: 600, normalL100: 29.5 });
  await s.addTruck(A.id, { plate: "CJ 08 QRT", vin: null, model: null, tankL: 700, normalL100: 31 });
  const b1 = await s.addTruck(B.id, { plate: "BH 21 QRT", vin: null, model: null, tankL: 600, normalL100: 29.5 });
  const dkv = fs.readFileSync("public/samples/dkv.csv", "utf8");
  const c1 = await commit(s, A.id, dkv, "dkv.csv");
  ok("import DKV în Postgres: 39 noi", c1.ok && c1.added === 39 && c1.dupes === 0, JSON.stringify({ ok: c1.ok, a: c1.ok && c1.added }));
  ok("potrivire pe plăcuță: 38 legate, 1 card necunoscut", (await s.fuel(A.id)).filter((x) => x.truckId).length === 38 && c1.summary.unknown.length === 1);
  ok("cardul învățat din plăcuță e reținut", (await s.fuelCards(A.id)).filter((c) => c.truckId).length === 2);
  const c2 = await commit(s, A.id, dkv, "dkv.csv");
  ok("reimport identic → 0 noi, 39 duplicate", c2.ok && c2.added === 0 && c2.dupes === 39);
  const pre = await analyze(s, A.id, dkv);
  ok("previzualizarea vede duplicatele", pre.summary.dupes === 39 && pre.summary.newRows === 0);
  const unk = c1.summary.unknown[0].card!;
  ok("card necunoscut → camion (mută tranzacțiile)", (await s.setCard(A.id, unk, a1.id)) === 1 && (await s.fuel(A.id)).every((x) => x.truckId));
  const omv = await commit(s, A.id, fs.readFileSync("public/samples/omv-routex.csv", "utf8"), "omv.csv");
  ok("al doilea card (OMV) se adaugă separat", omv.ok && omv.added === 39);
  // izolare
  ok("B nu vede tranzacțiile lui A", (await s.fuel(B.id)).length === 0 && (await s.fuelCards(B.id)).length === 0 && (await s.imports(B.id)).length === 0);
  let threw = false; try { await s.setCard(B.id, "X", a1.id); } catch { threw = true; }
  ok("B nu poate lega un card de camionul lui A", threw);
  threw = false; try { await s.addFuel(B.id, [{ truckId: a1.id, source: "generic", importId: null, hash: "h", card: null, plate: null, at: "2026-10-01T10:00", station: "", country: null, product: null, litres: 1, amount: null, currency: null, amountRon: null, fxRate: null, fxDate: null, odometer: null, lat: null, lng: null, userId: null, photoName: null, photoSize: null, aiRead: false }]); } catch { threw = true; }
  ok("B nu poate scrie tranzacții pe camionul lui A", threw);
  const cb = await commit(s, B.id, dkv, "dkv.csv");
  ok("același fișier la B: importat separat (fără duplicat între firme), pe camionul lui B", cb.ok && cb.added === 39 && (await s.fuel(B.id)).filter((x) => x.truckId === b1.id).length === 19);
  // bonuri șofer + ture în Postgres
  const { FirmRepository } = await import("../src/lib/firm-repo");
  const repo = new FirmRepository(s, (await s.firm(A.id))!);
  await repo.addDriverFill({ vehicleId: a1.id, time: "2026-10-20T08:00", litres: 210, odometerKm: 425000, amount: 1530, station: "Petrom", photo: { name: "bon.jpg", size: 1000 }, aiRead: false });
  await repo.setShift({ vehicleId: a1.id, start: "2026-10-20T06:00", end: null, checklist: ["tyres"] });
  const repo2 = new FirmRepository(s, (await s.firm(A.id))!);
  ok("bon șofer + tură persistate în Postgres", (await repo2.driverFills()).some((f) => f.photo?.name === "bon.jpg") && (await repo2.shift(a1.id))?.checklist[0] === "tyres");
  await pool.end();
}
console.log(fail ? `smoke:fuel: ${fail} eșec(uri)` : "smoke:fuel OK");
process.exit(fail ? 1 : 0);
