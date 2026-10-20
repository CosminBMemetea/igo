// Lockout counter and rate limiter: atomic under concurrency, window reset, lock escalation.
import { parseModelJson } from "../src/lib/model-json";
import assert from "node:assert/strict";
import { MemStore } from "../src/lib/store/mem";
import type { Store } from "../src/lib/store/types";
async function checks(s: Store, label: string) {
  const k = `u:race-${label}-${Date.now()}`;
  const results = await Promise.all(Array.from({ length: 20 }, () => s.authFail(k, 5, 15)));
  assert.deepEqual(results.map((r) => r.fails).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1), "each concurrent failure gets its own count");
  assert.ok((await s.authFails(k)).lockedUntil, "locked after 5");
  await s.authClear(k); assert.equal((await s.authFails(k)).fails, 0);
  const one = await s.authFail(k, 5, 15); assert.equal(one.fails, 1); assert.equal(one.lockedUntil, null);
  const r = `rl:test-${label}-${Date.now()}`;
  const hits = await Promise.all(Array.from({ length: 12 }, () => s.rateHit(r, 10, 60)));
  assert.equal(hits.filter((h) => h.ok).length, 10, "exactly the limit passes concurrently");
  assert.ok(hits.every((h) => h.retryAfterS >= 1 && h.retryAfterS <= 60));
  const short = `rl:short-${label}-${Date.now()}`;
  assert.ok((await s.rateHit(short, 1, 1)).ok); assert.equal((await s.rateHit(short, 1, 1)).ok, false);
  await new Promise((res) => setTimeout(res, 1200));
  assert.ok((await s.rateHit(short, 1, 1)).ok, "window resets");
  const rf = `rl:refund-${label}-${Date.now()}`;
  assert.ok((await s.rateHit(rf, 1, 60)).ok); await s.rateRefund(rf); assert.ok((await s.rateHit(rf, 1, 60)).ok, "refunded slot is reusable");
  assert.equal((await s.rateHit(rf, 1, 60)).ok, false); await s.rateRefund(rf); await s.rateRefund(rf); await s.rateRefund(rf);
  assert.equal((await s.rateHit(rf, 2, 60)).used, 1, "refund never goes below zero");
  console.log(`PASS ${label}: atomic lockout counter and rate limiter`);
}
await checks(new MemStore(), "memory");
if (process.env.PGLITE_MODULE) {
  const { PGlite } = await import(process.env.PGLITE_MODULE), { drizzle } = await import("drizzle-orm/node-postgres"), { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const schema = await import("../src/db/schema"), { PgStore } = await import("../src/lib/store/pg");
  const pg = new PGlite();
  const adapter = { query: async (q: string | { text: string; rowMode?: string }, values: unknown[]) => {
    const text = typeof q === "string" ? q : q.text;
    if (!values?.length && text.includes(";")) { const all = await pg.exec(text); return all[all.length - 1] ?? { rows: [], fields: [] }; } // migrations: multi-statement
    return pg.query(text, values, typeof q === "string" ? {} : { rowMode: q.rowMode as "array" | "object" | undefined });
  } };
  const d = drizzle(adapter as never, { schema });
  try { await migrate(d, { migrationsFolder: "drizzle" }); await checks(new PgStore(d as never), "pglite"); } finally { await pg.close(); }
} else if (process.env.TEST_DATABASE_URL) {
  const { default: pg } = await import("pg"), { drizzle } = await import("drizzle-orm/node-postgres"), { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const schema = await import("../src/db/schema"), { PgStore } = await import("../src/lib/store/pg");
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 10 });
  try { await migrate(drizzle(pool), { migrationsFolder: "drizzle" }); await checks(new PgStore(drizzle(pool, { schema }) as never), "postgres"); } finally { await pool.end(); }
} else console.log("SKIP Postgres: PGLITE_MODULE / TEST_DATABASE_URL missing");
assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 }); assert.deepEqual(parseModelJson('<think>{</think> Result: {"a":1} done'), { a: 1 });
assert.equal(parseModelJson("no json"), null); assert.equal(parseModelJson("[1]"), null);
console.log("PASS model JSON parsing tolerates fences, think blocks and surrounding text");
