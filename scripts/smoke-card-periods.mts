import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { MemStore } from "../src/lib/store/mem";
import { PgStore } from "../src/lib/store/pg";
import type { Store, NewFuelTx } from "../src/lib/store/types";
import { analyze, commit } from "../src/lib/fuel/import";
import { cardAt, LEGACY_CARD_FROM, normalizeCard } from "../src/lib/fuel/cards";
import * as schema from "../src/db/schema";

const tx = (hash: string, card: string, at: string, truckId: string | null = null, plate: string | null = null): NewFuelTx => ({ hash, card, at, truckId, plate, source: "generic", importId: null, station: "Test", country: "RO", product: "diesel", litres: 100, amount: 700, currency: "RON", amountRon: null, fxRate: null, fxDate: null, odometer: null, lat: null, lng: null, userId: null, photoName: null, photoSize: null, aiRead: false });
const truck = (plate: string) => ({ plate, vin: null, model: null, tankL: 600, normalL100: 30 });
const csv = (card: string, at: string, plate = "") => `Data;Card;Litri;Numar inmatriculare;Suma;Moneda\n${at};${card};120;${plate};840;RON\n`;
async function checks(s: Store, label: string) {
  const f = await s.createFirm({ name: "Periods " + label, cui: null });
  const a = await s.addTruck(f.id, truck("BH 01 AAA")), b = await s.addTruck(f.id, truck("BH 02 BBB")), c = await s.addTruck(f.id, truck("BH 03 CCC"));
  const other = await s.createFirm({ name: "Other", cui: null }), foreign = await s.addTruck(other.id, truck("BH 04 DDD"));
  await s.setCard(f.id, "000123", a.id, "2026-10-01T00:00");
  await s.addFuel(f.id, [tx("before", "000123", "2026-09-30T23:59"), tx("old", "000123", "2026-10-15T23:59"), tx("boundary", "000123", "2026-10-16T00:00"), tx("later", "000123", "2026-10-20T12:00"), tx("future", "000123", "2026-11-01T00:00")]);
  assert.equal(await s.setCard(f.id, "000123", c.id, "2026-11-01T00:00"), 1);
  assert.equal(await s.setCard(f.id, "000123", b.id, "2026-10-16T00:00"), 2);
  const ids = Object.fromEntries((await s.fuel(f.id)).map((x) => [x.hash, x.truckId]));
  assert.deepEqual(ids, { before: null, old: a.id, boundary: b.id, later: b.id, future: c.id });
  console.log(`PASS ${label}: earlier history, exact boundary and later periods preserved`);
  const history = await s.fuelCards(f.id);
  assert.equal(history.length, 3);
  assert.equal(cardAt(history, "000123", "2026-10-16T00:00")?.truckId, b.id);
  assert.equal(await s.setCard(f.id, "000123", b.id, "2026-10-16T00:00"), 0);
  await assert.rejects(s.setCard(f.id, "000123", a.id, "2026-10-16T00:00"));
  for (const from of ["2026-02-31T08:00", "2026-10-01", "2026-10-01T24:00", "2026-10-01T08:00Z", ""]) await assert.rejects(s.setCard(f.id, "BAD", a.id, from));
  for (const card of ["", " x", "1".repeat(41), "x\nx"]) await assert.rejects(s.setCard(f.id, card, a.id, "2026-10-01T00:00"));
  await assert.rejects(s.setCard(f.id, "X", foreign.id, "2026-10-01T00:00"));
  await s.setCard(other.id, "000123", foreign.id, "2026-10-01T00:00");
  assert.equal((await s.fuelCards(other.id)).length, 1);
  console.log(`PASS ${label}: strict timestamps, idempotency, leading zeros and tenant isolation`);

  assert.equal((await analyze(s, f.id, csv("000123", "2026-10-03T10:00"))).rows[0].truckId, a.id);
  assert.equal((await analyze(s, f.id, csv("000123", "2026-10-17T10:00"))).rows[0].truckId, b.id);
  const conflict = await commit(s, f.id, csv("000123", "2026-10-17T10:00", a.plate), "conflict.csv");
  assert.equal(conflict.ok, false); assert.equal(conflict.summary.conflicts.length, 1);
  const choice = await commit(s, f.id, csv("FILEONLY", "2026-10-17T10:00"), "choice.csv", undefined, { "FILEONLY": a.id });
  assert.equal(choice.ok, true); assert.equal((await s.fuelCards(f.id)).some((x) => x.card === "FILEONLY"), false);
  const multi = csv("MULTI", "2026-10-17T10:00", a.plate) + `2026-10-18T10:00;MULTI;120;${b.plate};840;RON\n`;
  assert.equal((await commit(s, f.id, multi, "multi.csv")).ok, true);
  assert.equal((await s.fuel(f.id)).find((x) => x.card === "MULTI" && x.at.startsWith("2026-10-17"))?.truckId, a.id);
  assert.equal((await s.fuel(f.id)).find((x) => x.card === "MULTI" && x.at.startsWith("2026-10-18"))?.truckId, b.id);
  await assert.rejects(s.setCard(f.id, "MULTI", a.id, "2026-10-01T00:00"));
  assert.equal((await s.fuelCards(f.id)).some((x) => x.card === "MULTI"), false);
  console.log(`PASS ${label}: late CSV uses historical truck; conflicts blocked; file choices cannot rewrite history`);

  const count = (await s.fuel(f.id)).length;
  const bulk = Array.from({ length: 401 }, (_, i) => tx(`atomic${i}`, "000123", "2026-10-18T10:00", i === 400 ? a.id : b.id));
  await assert.rejects(s.addFuel(f.id, bulk));
  assert.equal((await s.fuel(f.id)).length, count);
  assert.equal((await s.addFuel(f.id, [tx("boundary", "000123", "2026-10-16T00:00", a.id)])).dupes, 1);
  console.log(`PASS ${label}: stale mapping rolls back all 401 rows; identical retry remains a no-op`);

  const race = await Promise.allSettled([s.setCard(f.id, "RACE", a.id, "2026-10-01T00:00"), s.setCard(f.id, "RACE", b.id, "2026-10-01T00:00")]);
  assert.equal(race.filter((x) => x.status === "fulfilled").length, 1);
  await s.setCard(f.id, "RACEIMPORT", a.id, "2026-10-01T00:00");
  const concurrent = await Promise.allSettled([s.addFuel(f.id, [tx("racing", "RACEIMPORT", "2026-10-20T12:00", a.id)]), s.setCard(f.id, "RACEIMPORT", b.id, "2026-10-16T00:00")]);
  assert.equal(concurrent[1].status, "fulfilled");
  const racing = (await s.fuel(f.id)).find((x) => x.hash === "racing");
  assert.ok(!racing || racing.truckId === b.id);
  console.log(`PASS ${label}: simultaneous mappings/imports cannot leave inconsistent ownership`);
}
assert.equal(normalizeCard("00-01 23"), "000123");
const parser = await import("../src/lib/fuel/parse");
assert.equal(parser.parseFuelCsv(csv("00-01 23", "2026-10-01T10:00")).rows[0].card, "000123");
assert.equal(parser.parseFuelCsv(csv("1".repeat(41), "2026-10-01T10:00")).rows.length, 0);
console.log("PASS card normalization agrees with CSV; overlong identifiers rejected without truncation");
await checks(new MemStore(), "memory");
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL required: disposable database only");
const pool = new pg.Pool({ connectionString: url, max: 5 });
try {
  await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "igo-card-migrate-"));
  try {
    fs.cpSync("drizzle", dir, { recursive: true });
    const file = path.join(dir, "meta/_journal.json"), journal = JSON.parse(fs.readFileSync(file, "utf8"));
    journal.entries = journal.entries.filter((x: { idx: number }) => x.idx < 15); fs.writeFileSync(file, JSON.stringify(journal));
    await migrate(drizzle(pool), { migrationsFolder: dir });
    await pool.query("insert into firms(id,name,trial_start) values ('legacy','Legacy','2026-10-01'); insert into trucks(id,firm_id,plate,tank_l,normal_l100) values ('legacy-truck','legacy','BH 99 OLD',600,30); insert into fuel_cards(firm_id,card,truck_id) values ('legacy','000099','legacy-truck'), ('legacy','00-0099','legacy-truck'), ('legacy','AMB IG',null), ('legacy','AMBIG','legacy-truck'); insert into fuel_transactions(id,firm_id,truck_id,source,hash,card,at,litres) values ('legacy-tx','legacy','legacy-truck','generic','legacy-hash','000099','2025-01-01T12:00',100)");
    const before = (await pool.query("select * from fuel_transactions where id='legacy-tx'")).rows[0];
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    const s = new PgStore(drizzle(pool, { schema }) as never);
    assert.deepEqual((await pool.query("select * from fuel_transactions where id='legacy-tx'")).rows[0], before);
    assert.deepEqual(await s.fuelCards("legacy"), [{ card: "000099", truckId: "legacy-truck", validFrom: LEGACY_CARD_FROM }, { card: "AMBIG", truckId: null, validFrom: LEGACY_CARD_FROM }]);
    console.log("PASS migration: legacy mappings retained, existing transactions byte-for-byte unchanged, rerun safe");
    await checks(s, "PostgreSQL");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
} finally { await pool.end(); }
console.log("smoke:card-periods OK");
