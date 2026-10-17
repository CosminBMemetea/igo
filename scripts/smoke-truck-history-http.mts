// Requires a disposable TEST_DATABASE_URL and a production build. Deletes only its own fixtures.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema";
import { PgStore } from "../src/lib/store/pg";
import { signSession } from "../src/lib/session";
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const s = new PgStore(drizzle(pool, { schema }));
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
const port = 8100 + Math.floor(Math.random() * 500), baseURL = `http://localhost:${port}`, secret = randomUUID() + randomUUID();
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { stdio: "ignore", env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: secret, ADMIN_EMAIL: "", ADMIN_PASSWORD_HASH: "" } });
const firms: string[] = [];
try {
  for (let i = 0; i < 60; i++) { try { await fetch(baseURL + "/login"); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  const firm = await s.createFirm({ name: "History HTTP", cui: null }); firms.push(firm.id);
  await s.updateFirm(firm.id, { demoMode: false, detailsDone: true, csvSkipped: true });
  const foreign = await s.createFirm({ name: "Other tenant", cui: null }); firms.push(foreign.id);
  const truck = await s.addTruck(firm.id, { plate: "HISTORY QA", model: null, vin: null, tankL: 700, normalL100: 30 });
  const other = await s.addTruck(foreign.id, { plate: "OTHER QA", model: null, vin: null, tankL: 700, normalL100: 30 });
  const owner = await s.createUser({ firmId: firm.id, role: "owner", name: "Test owner", phone: null, email: randomUUID() + "@example.test", passwordHash: "test", truckId: null });
  const cookie = "igo-session=" + await signSession({ role: "owner", email: owner.email!, firm: firm.id, uid: owner.id, exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
  const req = (path: string) => fetch(baseURL + path, { redirect: "manual", headers: { cookie } });
  const base = { truckId: truck.id, driverId: null, client: "QA", date: "2026-01-17", km: 60, revenue: 1234, litres: 18, fuelPrice: 7, tolls: 0, driverCost: 100, other: 0, planned: false };
  const first = await s.addTrip(firm.id, { ...base, title: "Morning route", loadedAt: "2026-01-17T06:00:00Z", deliveredAt: "2026-01-17T07:00:00Z" });
  const second = await s.addTrip(firm.id, { ...base, title: "Second route", loadedAt: "2026-01-17T07:00:00Z", deliveredAt: "2026-01-17T08:00:00Z" });
  const planned = await s.addTrip(firm.id, { ...base, title: "Planned route", planned: true });
  for (const [i, at] of ["08:00", "08:10", "09:00", "09:10"].entries()) await s.addPosition(firm.id, { truckId: truck.id, at: `2026-01-17T${at}`, lat: 46 + i * .01, lng: 22 });
  // Next can flush the layout before an async page redirect/notFound: validate
  // either the HTTP result or the equivalent streamed navigation instruction.
  const redirected = await req(`/replay?v=${truck.id}`), destination = `/vehicles/${truck.id}/history`;
  if (redirected.status === 307) assert.equal(redirected.headers.get("location"), destination);
  else { assert.equal(redirected.status, 200); const html = await redirected.text(); assert.ok(html.includes('http-equiv="refresh"')); assert.ok(html.includes(`url=${destination}`)); }
  for (const path of [`/replay?trip=missing`, `/replay?v=${other.id}&d=2026-01-17`, `/vehicles/${other.id}/history`, `/replay?trip=${first.id}&v=${other.id}`]) {
    const res = await req(path), html = await res.text();
    assert.ok(res.status === 404 || res.status === 200 && html.includes("NEXT_NOT_FOUND"), path);
    assert.equal(html.includes(other.plate), false);
  }
  console.log("PASS HTTP: truck replay requires explicit choice; unknown and foreign resources rejected");
  const history = await (await req(`/vehicles/${truck.id}/history?month=2026-01`)).text();
  for (const trip of [first, second, planned]) assert.ok(history.includes(trip.title));
  assert.ok(history.includes(`/replay?trip=${first.id}`)); assert.ok(history.includes(`/replay?trip=${second.id}`));
  assert.equal(history.includes(`/replay?trip=${planned.id}`), false);
  const empty = await (await req(`/vehicles/${truck.id}/history?month=2025-12`)).text(); assert.equal(empty.includes(first.title), false);
  const replay = await (await req(`/replay?trip=${first.id}&d=2026-01-16`)).text();
  assert.ok(replay.includes(first.title)); assert.ok(replay.includes("2026-01-17 08:00")); assert.equal(replay.includes(second.title), false);
  const day = await (await req(`/replay?v=${truck.id}&d=2026-01-17`)).text();
  assert.ok(day.includes("GPS-ul zilei")); assert.equal(day.includes(first.title), false); assert.equal(day.includes(second.title), false);
  assert.ok(day.includes("Sfârșitul datelor GPS"));
  console.log("PASS HTTP: monthly history, future trip gating, trip interval over date override and independent day scope");
} finally { server.kill(); for (const id of firms) await s.deleteFirm(id); await pool.end(); }
