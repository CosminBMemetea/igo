import assert from "node:assert/strict";
import { discardDependants, drain, transmit, type OutboxItem, type QueueStorage } from "../src/lib/outbox";
const item = (id: string, scope = "firm:user"): OutboxItem => ({ id, scope, actorId: "user", kind: "event", label: id, created: 1, payload: { tripId: "trip", kind: "loaded", occurredAt: "2026-10-14T10:00:00.000Z" }, status: "pending" });
let jobs: OutboxItem[] = [];
const storage: QueueStorage = { list: async scope => jobs.filter(x => x.scope === scope), remove: async (scope,id) => { jobs = jobs.filter(x => x.scope !== scope || x.id !== id); }, block: async item => { jobs = jobs.map(x => x.id === item.id ? item : x); } };
const ok = () => Response.json({ ok: true });
jobs = [item("load"), item("unload"), item("foreign", "other")];
assert.equal(await drain("firm:user", storage, async () => { throw new Error("offline"); }), 0);
assert.equal(jobs.length, 3);
const seen: string[] = [];
assert.equal(await drain("firm:user", storage, async x => { seen.push(x.id); return ok(); }), 2);
assert.deepEqual(seen, ["load", "unload"]);
assert.deepEqual(jobs.map(x => x.id), ["foreign"]);
for (const status of [408,429,500,503]) {
  jobs = [item("load"), item("unload")];
  assert.equal(await drain("firm:user", storage, async () => new Response(null,{status})), 0);
  assert.equal(jobs[0].status, "pending"); assert.equal(jobs.length, 2);
}
for (const response of [new Response(null, {status:409}), new Response(null, {status:403}), new Response(null, {status:401}), Response.json({demo:true}), new Response("login", {status:200})]) {
  jobs = [item("load"), item("unload")]; let calls = 0;
  await drain("firm:user", storage, async () => { calls++; return response; });
  assert.equal(calls,1); assert.equal(jobs[0].status,"blocked"); assert.equal(jobs.length,2);
  await drain("firm:user", storage, async () => { assert.fail("blocked first action must stop dependent events"); });
}
let request: RequestInit | undefined;
const send = (async (_url: unknown, init: RequestInit | undefined) => { request = init; return ok(); }) as typeof fetch;
await transmit(item("stable-key"), send);
assert.equal(JSON.parse(request!.body as string).key,"stable-key");
assert.equal(JSON.parse(request!.body as string).actorId,"user");
assert.equal(JSON.parse(request!.body as string).occurredAt,"2026-10-14T10:00:00.000Z");
const receipt = item("receipt-key"); receipt.kind = "fill";
receipt.payload = [["date", "2026-10-13"], ["photo", new File(["photo-data"], "receipt.jpg", {type:"image/jpeg"})]];
await transmit(receipt, send);
const fd = request!.body as FormData;
assert.equal(fd.get("date"), "2026-10-13"); assert.equal(fd.get("key"), "receipt-key");
assert.equal(await (fd.get("photo") as File).text(), "photo-data");
console.log("PASS outbox: offline retention, FIFO, retryable responses, blocked conflicts, account scope, original timestamp, stable keys and receipt file");

const blockedLoad={...item("load"),created:1,status:"blocked" as const};
const nextUnload={...item("unload"),created:2,payload:{tripId:"trip",kind:"unloaded",occurredAt:"2026-10-14T10:10:00.000Z"}};
const independent={...item("independent"),created:3,payload:{tripId:"another-trip",kind:"loaded",occurredAt:"2026-10-14T10:11:00.000Z"}};
assert.deepEqual(discardDependants([blockedLoad,nextUnload,independent,item("foreign","other")],"firm:user","load").map(e=>[e.id,e.status]),[["unload","blocked"]]);
assert.deepEqual(discardDependants([blockedLoad,nextUnload],"other","load"),[]);
console.log("PASS explicit discard flags dependent events without affecting another trip or account");
let release!:()=>void;
jobs=[blockedLoad,nextUnload].map(e=>({...e,status:"pending" as const}));
const inflight=drain("firm:user",storage,async e=>{assert.equal(e.id,"load");await new Promise<void>(resolve=>{release=resolve;});return ok();});
await new Promise(resolve=>setTimeout(resolve,0));
const dependants=discardDependants(jobs,"firm:user","load");jobs=jobs.filter(e=>e.id!=="load").map(e=>dependants.find(d=>d.id===e.id)??e);
release();await inflight;assert.equal(jobs[0].id,"unload");assert.equal(jobs[0].status,"blocked");
console.log("PASS discard during in-flight ACK cannot send an already-blocked dependant");
