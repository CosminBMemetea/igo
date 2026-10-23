// GPS retention: points older than 90 days are deleted daily; recent points and trip records stay.
import assert from "node:assert/strict";
import { MemStore } from "../src/lib/store/mem";
import { POSITION_RETENTION_DAYS, positionCutoff, purgeOldPositions } from "../src/lib/retention";
import { windowPositions, dayReplayWindow } from "../src/lib/truck-history";
import type { Store } from "../src/lib/store/types";

const NOW = Date.parse("2026-10-23T09:00:00Z");
assert.equal(POSITION_RETENTION_DAYS, 90);
assert.equal(positionCutoff(NOW), "2026-07-25");
const day = (n: number) => new Date(NOW - n * 86400000).toISOString().slice(0, 10);

async function check(s: Store, label: string) {
  const firm = await s.createFirm({ name: "Retention QA " + Math.random().toString(36).slice(2, 8), cui: null });
  try {
    const truck = await s.addTruck(firm.id, { plate: "RT 01 QRT", vin: null, model: null, tankL: 600, normalL100: 30 });
    const old = day(120), edge = day(91), keep = day(89), today = day(0);
    for (const [d, i] of [[old, 0], [old, 1], [edge, 2], [keep, 3], [keep, 4], [today, 5]] as const)
      await s.addPosition(firm.id, { truckId: truck.id, at: `${d}T08:0${i}`, lat: 46 + i / 100, lng: 22 });
    // legacy ISO-format point, also old
    await s.addPosition(firm.id, { truckId: truck.id, at: `${old}T06:00:00.000Z`, lat: 46, lng: 22 });
    const trip = await s.addTrip(firm.id, { truckId: truck.id, client: "QA", title: "A → B", date: old, km: 640, revenue: 4200, litres: 190, fuelPrice: 7, tolls: 0, driverCost: 0, other: 0, planned: false, litresSource: "manual" });
    const r = await purgeOldPositions(s, NOW);
    assert.ok(r.positionsDeleted >= 4, `${label}: deleted ${r.positionsDeleted}`);
    const left = await s.positions(firm.id);
    assert.deepEqual(left.map((p) => p.at.slice(0, 10)).sort(), [keep, keep, today]);
    const trips = await s.trips(firm.id), t = trips.find((x) => x.id === trip.id);
    assert.ok(t, `${label}: trip kept`); assert.equal(t!.km, 640); assert.equal(t!.revenue, 4200);
    // replay of a recent day still works; an expired day is simply empty (no crash)
    const w = dayReplayWindow(keep)!, wOld = dayReplayWindow(old)!;
    assert.equal(windowPositions(left, truck.id, w).length, 2);
    assert.equal(windowPositions(left, truck.id, wOld).length, 0);
    const again = await purgeOldPositions(s, NOW);
    assert.equal((await s.positions(firm.id)).length, 3, `${label}: idempotent`); void again;
    console.log(`PASS ${label}: >90-day GPS points purged (local + ISO formats), recent kept, trip summary kept, replay intact, idempotent`);
  } finally { await s.deleteFirm(firm.id).catch(() => {}); }
}

await check(new MemStore(), "memory");
if (process.env.TEST_DATABASE_URL) {
  const { default: pg } = await import("pg"), { drizzle } = await import("drizzle-orm/node-postgres"), { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const schema = await import("../src/db/schema"), { PgStore } = await import("../src/lib/store/pg");
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
  try { await migrate(drizzle(pool), { migrationsFolder: "drizzle" }); await check(new PgStore(drizzle(pool, { schema })), "postgres"); } finally { await pool.end(); }
} else console.log("SKIP Postgres: TEST_DATABASE_URL unavailable");
