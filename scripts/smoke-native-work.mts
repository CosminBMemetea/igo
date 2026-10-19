import assert from "node:assert/strict";
import { createWorkQueue, projectedBoard, type WorkEntry, type WorkState } from "../apps/driver/src/work-queue";
import type { Board } from "../apps/driver/src/board";
let saved: WorkState | null = null, scope = "owner-a/driver-a", now = Date.parse("2026-10-19T10:00:00Z");
let failSave = false;
let send: (e: WorkEntry) => Promise<void> = async () => {};
const calls: string[] = [];
const dependencies = {
  load: async () => structuredClone(saved),
  save: async (s: WorkState) => { if (failSave) throw Error("disk-full"); saved = structuredClone(s); },
  scope: async () => scope, now: () => now,
  send: async (e: WorkEntry) => { calls.push(e.id); await send(e); },
};
const event = (id: string, kind: "loaded" | "unloaded" | "wait_start" | "wait_end" = "loaded", tripId = "trip"): WorkEntry => ({
  id, scope, tripId, title: "Oradea → Viena", createdAt: new Date(now++).toISOString(), type: "event", kind,
  truckId: "truck", shiftStart: "2026-10-19T08:00:00Z", status: "queued", attempts: 0, nextAttempt: 0,
});
const reset = () => { saved = null; calls.length = 0; send = async () => {}; scope = "owner-a/driver-a"; return createWorkQueue(dependencies); };
let q = reset();
failSave = true; await assert.rejects(q.add(event("disk-full"))); assert.equal(calls.length, 0); failSave = false;
await q.add(event("lost-ack")); send = async () => { throw Error("lost response after commit"); };
await assert.rejects(q.sync(scope)); assert.equal((await q.list(scope))[0].status, "queued");
q = createWorkQueue(dependencies); send = async () => {};
await q.sync(scope); assert.equal(calls.length, 1, "persisted backoff survives restart");
await q.sync(scope, true); assert.deepEqual(calls, ["lost-ack", "lost-ack"]); assert.equal((await q.list(scope))[0].status, "confirmed");
await q.submit(scope, "lost-ack"); await q.sync(scope, true); assert.equal(calls.length, 2, "stale retry cannot resend acknowledged work");
console.log("PASS durable work: disk-full fails before sending; lost ACK and process restart reuse IDs; backoff persists; confirmed work stays confirmed");
q = reset();
await q.add(event("load")); await q.add(event("wait", "wait_start")); await q.add(event("stop", "wait_end")); await q.add(event("unload", "unloaded"));
const board: Board = { name: "Driver", firm: "Firm", truck: { id: "truck", plate: "BH QA" }, shift: { start: "2026-10-19T08:00:00Z", end: null }, serverTime: new Date(now).toISOString(), trips: { ready: [{ id: "trip", truckId: "truck", title: "Oradea → Viena", date: "2026-10-19", client: "QA", planned: true }] }, progress: { completed: 0, lifetime: 0, rank: null, participants: 0, badges: [], next: null } };
await q.cache(scope, board);
const projection = projectedBoard((await q.snapshot(scope))!, await q.list(scope));
assert.equal(projection.trips.running.length, 0); assert.equal(projection.trips.documents.length, 1); assert.equal(projection.trips.documents[0].localPending, true); assert.equal(projection.progress?.completed, 0); assert.equal(board.trips.ready[0].deliveredAt, undefined);
await q.sync(scope); assert.deepEqual(calls, ["load", "wait", "stop", "unload"]);
console.log("PASS offline sequence: load/wait/stop/unload replay in order; local delivery is marked pending, no invented POD or rewards; source snapshot unchanged");
q = reset(); await q.add(event("conflict")); await q.add(event("dependent", "unloaded")); await q.add(event("independent", "loaded", "other-trip"));
send = async e => { if (e.id === "conflict") throw { status: 409, code: "transition" }; };
await q.sync(scope); assert.deepEqual(calls, ["conflict", "independent"]); assert.equal((await q.list(scope))[0].status, "attention");
await q.discard(scope, "conflict"); assert.equal((await q.list(scope))[0].status, "attention", "removing predecessor cannot blindly replay dependent unload");
console.log("PASS reconciliation: conflict pauses its trip, other trips continue; removing a predecessor flags dependent work");
q = reset(); await q.add(event("a")); scope = "owner-b/driver-b";
assert.equal((await q.list(scope)).length, 0); assert.equal(await q.snapshot(scope), null); await q.sync(scope); assert.equal(calls.length, 0);
await assert.rejects(q.add({ ...event("foreign"), scope: "owner-a/driver-a" }));
scope = "owner-a/driver-a"; send = async () => { scope = "owner-b/driver-b"; };
await q.add(event("b")); await q.sync(scope); assert.deepEqual(calls, ["a"]); assert.equal((await q.list("owner-a/driver-a"))[0].status, "confirmed");
console.log("PASS account isolation: no other driver's board or work; account switch during send cannot dispatch the next command");
q = reset(); await q.add(event("slow")); let release!: () => void;
send = () => new Promise<void>(r => { release = r; });
const first = q.sync(scope); await new Promise(r => setTimeout(r, 0));
await assert.rejects(q.discard(scope, "slow")); await q.add(event("new"));
const second = q.sync(scope); release(); await Promise.all([first, second]);
assert.deepEqual(calls, ["slow"]); assert.equal((await q.list(scope)).length, 2); assert.equal((await q.list(scope))[1].status, "queued");
send = async () => {}; await q.sync(scope); assert.deepEqual(calls, ["slow", "new"]);
console.log("PASS races: one sender; late ACK preserves new work; in-flight deletion rejected");
q = reset(); await q.add(event("auth")); send = async () => { throw { status: 401 }; }; await assert.rejects(q.sync(scope));
assert.equal((await q.list(scope))[0].status, "queued"); assert.match((await q.list(scope))[0].message!, /Autentifică/);
q = reset(); const draft: WorkEntry = { id: "draft", scope, tripId: "trip", title: "QA", createdAt: new Date(now).toISOString(), status: "draft", attempts: 0, nextAttempt: 0, type: "file", kind: "pod", fileName: "work-qa.jpg", size: 200 };
await q.add(draft); await q.sync(scope); assert.equal(calls.length, 0, "preview is never uploaded before driver sends");
q = createWorkQueue(dependencies); assert.equal((await q.list(scope))[0].status, "draft");
await q.submit(scope, draft.id); send = async () => { throw { status: 422, code: "local-file-missing" }; }; await q.sync(scope);
assert.equal((await q.list(scope))[0].status, "attention"); assert.match((await q.list(scope))[0].message!, /Fotografia locală/);
console.log("PASS documents: draft survives restart and requires explicit submit; missing file requires attention; expired session retains work");
