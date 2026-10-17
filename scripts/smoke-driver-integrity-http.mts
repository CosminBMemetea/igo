// Requires TEST_DATABASE_URL (disposable DB) and an existing production build. Does not reset the schema.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import sharp from "sharp";
import * as schema from "../src/db/schema";
import { PgStore } from "../src/lib/store/pg";
import { signSession } from "../src/lib/session";
import { SHIFT_CHECKS } from "../src/lib/shift-checklist";
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
const secret = randomUUID() + randomUUID(), port = 7500 + Math.floor(Math.random() * 500), baseURL = `http://localhost:${port}`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const s = new PgStore(drizzle(pool, { schema }));
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { stdio: "ignore", env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: secret, ADMIN_EMAIL: "", ADMIN_PASSWORD_HASH: "" } });
let firmId = "";
try {
  for (let i = 0; i < 60; i++) { try { await fetch(baseURL + "/login"); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  const firm = await s.createFirm({ name: "HTTP integrity", cui: null }); firmId = firm.id;
  await s.updateFirm(firm.id, { demoMode: false, detailsDone: true, csvSkipped: true });
  const truck = await s.addTruck(firm.id, { plate: "QA HTTP", model: null, vin: null, tankL: 700, normalL100: 30 });
  const cookies: Record<string, string> = {}, users: Record<string, string> = {};
  for (const role of ["driver", "owner"] as const) {
    const u = await s.createUser({ firmId: firm.id, role, name: role, phone: null, email: randomUUID() + "@example.test", passwordHash: "test", truckId: role === "driver" ? truck.id : null }); users[role] = u.id;
    cookies[role] = "igo-session=" + await signSession({ role, email: u.email!, firm: firm.id, uid: u.id, exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
  }
  const req = (path: string, body?: unknown, role = "driver") => fetch(baseURL + path, { method: body === undefined ? "GET" : "POST", redirect: "manual", headers: { cookie: cookies[role], accept: "application/json", ...(body instanceof FormData || body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  for (const checklist of [[], ["chk.tyres", "chk.tyres", "chk.docs"], ["chk.tyres", "chk.docs", "arbitrary"]]) assert.equal((await req("/api/driver/shift", { vehicleId: truck.id, action: "start", checklist })).status, 400);
  assert.equal((await req("/api/driver/shift", { vehicleId: truck.id, action: "start", checklist: SHIFT_CHECKS })).status, 200);
  assert.equal((await req("/api/driver/shift", { vehicleId: truck.id, action: "start" })).status, 200, "retry is idempotent");
  assert.equal((await (await req("/api/driver/tracking")).json()).enabled, true);
  assert.equal((await req("/api/driver/ping", { vehicleId: truck.id, lat: 46, lng: 22 })).status, 204);
  assert.equal((await req("/api/driver/private", { vehicleId: truck.id, on: true })).status, 200);
  assert.equal((await (await req("/api/driver/tracking")).json()).enabled, false);
  assert.equal((await req("/api/driver/ping", { vehicleId: truck.id, lat: 46, lng: 22 })).status, 409);
  const archive = new FormData(); archive.set("action", "archive"); archive.set("vid", truck.id);
  assert.equal((await req("/api/vehicles/econ", archive, "owner")).status, 409);
  assert.equal((await s.trucks(firm.id))[0].archivedAt, null);
  console.log("PASS HTTP: checklist validation/retry, authoritative tracker state, private GPS, archive conflict");
  const trip = await s.addTrip(firm.id, { truckId: truck.id, driverId: users.driver, title: "QA", client: "QA", date: "2026-10-17", km: 500, revenue: 1000, litres: 150, fuelPrice: 7, tolls: 0, driverCost: 0, other: 0, planned: true });
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } }).png().toBuffer();
  const upload = (bytes = png) => { const f = new FormData(); f.set("tripId", trip.id); f.set("kind", "pod"); f.set("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "proof.png"); return req("/api/files", f); };
  assert.equal((await upload(Buffer.from("not an image"))).status, 415);
  assert.equal(!!(await s.trips(firm.id))[0].podReceived, false);
  try {
    await pool.query(`create function qa_http_pod_failure() returns trigger language plpgsql as $$ begin if new.id = '${trip.id}' and new.pod_received then raise exception 'sensitive_query_marker'; end if; return new; end $$`);
    await pool.query("create trigger qa_http_pod_failure before update on trips for each row execute function qa_http_pod_failure()");
    const failed = await upload(); assert.equal(failed.status, 503);
    const text = await failed.text(); assert.equal(text.includes("sensitive_query_marker"), false); assert.equal(text.includes("insert into"), false); assert.ok(JSON.parse(text).reference);
    assert.equal((await s.files(firm.id, { tripId: trip.id })).length, 0);
  } finally { await pool.query("drop trigger if exists qa_http_pod_failure on trips; drop function if exists qa_http_pod_failure()"); }
  const first = await upload(), second = await upload(); assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.equal((await first.json()).id, (await second.json()).id);
  assert.equal((await s.files(firm.id, { tripId: trip.id })).length, 1);
  await s.cancelTrip(firm.id, trip.id, "QA"); assert.equal((await upload()).status, 409);
  console.log("PASS HTTP: invalid content 415, atomic POD rollback, safe 503 reference, retry deduplication, cancelled upload 409");
  assert.equal((await fetch(baseURL + "/_next/image?url=%2Ffavicon.ico&w=64&q=75")).status, 404);
  console.log("PASS HTTP: unused image optimizer disabled");
} finally { server.kill(); if (firmId) await s.deleteFirm(firmId); await pool.end(); }
