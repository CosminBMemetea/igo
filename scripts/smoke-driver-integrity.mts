import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import * as schema from "../src/db/schema";
import { MemStore } from "../src/lib/store/mem";
import { PgStore } from "../src/lib/store/pg";
import type { Store } from "../src/lib/store/types";
import { saveFile, validateFileContent } from "../src/lib/files";
import { operationCode } from "../src/lib/operation-error";
import { SHIFT_CHECKS, validShiftChecklist } from "../src/lib/shift-checklist";
import { startWebTracking } from "../src/lib/web-tracking";
import { summarizeTrip } from "../src/lib/paperwork";

for (const invalid of [null, [], ["chk.tyres"], ["chk.tyres", "chk.tyres", "chk.docs"], ["chk.tyres", "chk.docs", "unknown"]]) assert.equal(validShiftChecklist(invalid), false);
assert.equal(validShiftChecklist(SHIFT_CHECKS.slice(0, 3)), true);
assert.equal(operationCode(new Error("select password_hash from users")), undefined);
assert.equal(operationCode({ cause: new Error("trip-closed") }), "trip-closed");
console.log("PASS unique known checklist and allowlisted client errors");
const persisted = summarizeTrip([], { loadedAt: "2026-10-17T08:00:00Z", deliveredAt: "2026-10-17T12:00:00Z" });
assert.equal(persisted.loadedAt, "2026-10-17T08:00:00Z"); assert.equal(persisted.unloadedAt, "2026-10-17T12:00:00Z");
console.log("PASS historical trips retain loaded/delivered controls without journal events");

const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } }).png().toBuffer();
for (const format of ["jpeg", "png", "webp"] as const) {
  await validateFileContent(await sharp(png).toFormat(format).toBuffer(), `image/${format}`);
}
const pdf = await PDFDocument.create(); pdf.addPage(); await validateFileContent(Buffer.from(await pdf.save()), "application/pdf");
for (const [bytes, mime] of [[Buffer.from("not an image"), "image/png"], [png, "image/jpeg"], [png.subarray(0, 32), "image/png"], [Buffer.from("%PDF-1.7\ninvalid\n%%EOF"), "application/pdf"]] as const) await assert.rejects(validateFileContent(bytes, mime), /type/);
console.log("PASS decoded JPEG/PNG/WebP/PDF; spoofed MIME and corrupt content rejected");

const tick = () => new Promise(r => setTimeout(r, 0));
let callback: PositionCallback = () => {}, cleared = 0, calls = 0, signal: AbortSignal | null = null;
let resolveFetch: (r: Response) => void = () => {};
const geo = { watchPosition: (cb: PositionCallback) => { callback = cb; return 8; }, clearWatch: (id: number) => { assert.equal(id, 8); cleared++; } } as Geolocation;
const reports: string[] = [];
const stop = startWebTracking(geo, "truck", s => reports.push(s.gps), () => {}, (async (_url, options) => { calls++; signal = options?.signal as AbortSignal; return new Promise<Response>(r => { resolveFetch = r; }); }) as typeof fetch);
const position = (timestamp = Date.now(), accuracy = 10) => ({ timestamp, coords: { latitude: 46, longitude: 22, accuracy } }) as GeolocationPosition;
callback(position(Date.now() - 60000)); callback(position(Date.now(), 100)); assert.equal(calls, 0);
callback(position()); callback(position()); assert.equal(calls, 1);
stop(); assert.equal((signal as unknown as AbortSignal).aborted, true);
resolveFetch(new Response(null, { status: 204 })); await tick(); callback(position());
assert.equal(cleared, 1); assert.equal(calls, 1); assert.equal(reports.includes("ok"), false);
console.log("PASS GPS stale fix, accuracy, in-flight guard, cleanup, abort and late response isolation");

async function verify(s: Store, pool?: pg.Pool) {
  const firm = await s.createFirm({ name: "Integrity " + randomUUID(), cui: null });
  try {
    const truck = await s.addTruck(firm.id, { plate: "QA INTEGRITY", model: null, vin: null, tankL: 700, normalL100: 30 });
    const user = await s.createUser({ firmId: firm.id, role: "driver", name: "Test", email: randomUUID() + "@example.test", phone: null, passwordHash: "test", truckId: truck.id });
    const shift = { truckId: truck.id, start: new Date().toISOString(), end: null, checklist: [...SHIFT_CHECKS] };
    const base = { truckId: truck.id, driverId: user.id, client: "QA", title: "Arad → Viena", date: "2026-10-17", km: 500, revenue: 1000, litres: 150, fuelPrice: 7, tolls: 0, driverCost: 0, other: 0, planned: true };
    const trip = await s.addTrip(firm.id, base);
    await assert.rejects(s.updateTruckEcon(firm.id, truck.id, { archived: true }));
    await s.cancelTrip(firm.id, trip.id, "Test");
    const file = { kind: "pod" as const, tripId: trip.id, name: "proof.png", mime: "image/png", bytes: png, userId: user.id };
    await assert.rejects(saveFile(s, firm.id, file));
    assert.equal((await s.files(firm.id, { tripId: trip.id })).length, 0);
    await s.setShift(firm.id, shift);
    await assert.rejects(s.updateTruckEcon(firm.id, truck.id, { archived: true }));
    const pos = { truckId: truck.id, at: "2026-10-17T12:00:00", lat: 46, lng: 22 };
    assert.equal(await s.addDriverPosition(firm.id, user.id, pos), true);
    assert.equal(await s.addDriverPosition(firm.id, "another-user", pos), false);
    await s.setShift(firm.id, { ...shift, privateSince: shift.start });
    assert.equal(await s.addDriverPosition(firm.id, user.id, pos), false);
    await s.setShift(firm.id, { ...shift, end: new Date(Date.now() + 1000).toISOString() });
    assert.equal(await s.addDriverPosition(firm.id, user.id, pos), false);
    const delivered = await s.addTrip(firm.id, { ...base, planned: false, deliveredAt: new Date().toISOString() });
    const saved = await Promise.all(Array.from({ length: 5 }, () => saveFile(s, firm.id, { ...file, tripId: delivered.id })));
    assert.equal(new Set(saved.map(x => x.id)).size, 1);
    assert.equal((await s.files(firm.id, { tripId: delivered.id })).length, 1);
    assert.equal((await s.trips(firm.id)).find(x => x.id === delivered.id)?.podReceived, true);
    await s.updateTruckEcon(firm.id, truck.id, { archived: true });
    await assert.rejects(s.addTrip(firm.id, base));
    await assert.rejects(s.setShift(firm.id, { ...shift, start: new Date(Date.now() + 2000).toISOString() }));
    console.log(`PASS ${s.persistent ? "Postgres" : "memory"}: active shift/trip archive guards, cancelled uploads, POD deduplication, private/off-shift GPS`);
    if (pool) {
      const fault = await s.addTrip(firm.id, { ...base, planned: false, deliveredAt: new Date().toISOString() });
      try {
        await pool.query(`create function qa_pod_failure() returns trigger language plpgsql as $$ begin if new.id = '${fault.id}' and new.pod_received then raise exception 'injected query with sensitive parameters'; end if; return new; end $$`);
        await pool.query("create trigger qa_pod_failure before update on trips for each row execute function qa_pod_failure()");
        await assert.rejects(saveFile(s, firm.id, { ...file, tripId: fault.id }));
        assert.equal((await s.files(firm.id, { tripId: fault.id })).length, 0);
        assert.equal(!!(await s.trips(firm.id)).find(t => t.id === fault.id)?.podReceived, false);
      } finally { await pool.query("drop trigger if exists qa_pod_failure on trips; drop function if exists qa_pod_failure()"); }
      await saveFile(s, firm.id, { ...file, tripId: fault.id });
      assert.equal((await s.files(firm.id, { tripId: fault.id })).length, 1);
      console.log("PASS Postgres: injected POD failure rolls back metadata; retry stores one file");
      // Deliberately hold the losing request behind the row lock, not only Promise.all timing.
      const client = await pool.connect();
      try {
        const t = await s.addTruck(firm.id, { plate: "QA RACE", model: null, vin: null, tankL: 700, normalL100: 30 });
        await client.query("begin");
        await client.query("update trucks set archived_at = now() where id = $1", [t.id]);
        const start = s.setShift(firm.id, { ...shift, truckId: t.id }).then(() => true, () => false);
        await new Promise(r => setTimeout(r, 50)); await client.query("commit"); assert.equal(await start, false);
        await s.updateTruckEcon(firm.id, t.id, { archived: false });
        await client.query("begin");
        await client.query('insert into shifts (firm_id, truck_id, start) values ($1,$2,$3)', [firm.id, t.id, shift.start]);
        const archive = s.updateTruckEcon(firm.id, t.id, { archived: true }).then(() => true, () => false);
        await new Promise(r => setTimeout(r, 50)); await client.query("commit"); assert.equal(await archive, false);
        await s.updateTruckEcon(firm.id, truck.id, { archived: false });
        const current = { ...shift, start: new Date(Date.now() + 5000).toISOString() };
        await s.setShift(firm.id, current);
        await client.query("begin");
        await client.query("update shifts set private_since = $1 where firm_id = $2 and truck_id = $3", [current.start, firm.id, truck.id]);
        const ping = s.addDriverPosition(firm.id, user.id, pos);
        await new Promise(r => setTimeout(r, 50)); await client.query("commit"); assert.equal(await ping, false);
        console.log("PASS Postgres contention: archive/start in both orders and privacy/ping cannot leave invalid states");
      } finally { await client.query("rollback"); client.release(); }
    }
  } finally { await s.deleteFirm(firm.id); }
}
await verify(new MemStore());
if (process.env.TEST_DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 5 });
  try { await migrate(drizzle(pool), { migrationsFolder: "drizzle" }); await verify(new PgStore(drizzle(pool, { schema })), pool); }
  finally { await pool.end(); }
} else console.log("SKIP Postgres: TEST_DATABASE_URL missing");
