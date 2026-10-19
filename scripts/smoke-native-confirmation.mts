import assert from "node:assert/strict";
import { confirmTripEvent, type TripIntent } from "../apps/driver/src/trip-confirmation";
import type { Snapshot, WorkEntry } from "../apps/driver/src/work-queue";
const now=Date.parse("2026-10-19T10:00:00Z"), shiftStart="2026-10-19T08:00:00Z";
const intent:TripIntent={tripId:"trip",truckId:"truck",shiftStart,kind:"loaded"};
const snapshot:Snapshot={savedAt:now,board:{name:"Driver",firm:"QA",truck:{id:"truck",plate:"QA"},shift:{start:shiftStart,end:null},serverTime:new Date(now).toISOString(),trips:{ready:[{id:"trip",truckId:"truck",title:"QA",date:"2026-10-19",client:"QA",planned:true}]}}};
assert.equal(confirmTripEvent(snapshot,[],intent,now).id,"trip");
for(const mutate of [
 (s:Snapshot)=>{s.board.shift!.end=new Date(now).toISOString();},
 (s:Snapshot)=>{s.board.shift!.privateSince=new Date(now).toISOString();},
 (s:Snapshot)=>{s.board.shift!.start="2026-10-19T09:00:00Z";},
 (s:Snapshot)=>{s.board.truck!.id="reassigned";},
 (s:Snapshot)=>{s.board.trips.ready[0].truckId="reassigned";},
 (s:Snapshot)=>{s.board.trips.ready[0].cancelledAt=new Date(now).toISOString();},
 (s:Snapshot)=>{s.board.trips.ready[0].deliveredAt=new Date(now).toISOString();},
 (s:Snapshot)=>{s.board.trips.ready[0].date="2026-10-20";},
 (s:Snapshot)=>{s.savedAt=now-86400001;},
 (s:Snapshot)=>{s.savedAt=now+300001;},
]){const changed=structuredClone(snapshot);mutate(changed);assert.throws(()=>confirmTripEvent(changed,[],intent,now));}
const load:WorkEntry={...intent,id:"load",scope:"scope",title:"QA",type:"event",createdAt:new Date(now).toISOString(),status:"queued",attempts:0,nextAttempt:0};
assert.throws(()=>confirmTripEvent(snapshot,[load],intent,now),"second confirmation sees queued load");
assert.equal(confirmTripEvent(snapshot,[load],{...intent,kind:"unloaded"},now).id,"trip");
assert.throws(()=>confirmTripEvent(snapshot,[{...load,status:"attention"}],intent,now));
assert.throws(()=>confirmTripEvent(snapshot,[],{...intent,kind:"unloaded"},now));
assert.throws(()=>confirmTripEvent(snapshot,[],{...intent,kind:"wait_end"},now));
const wait:WorkEntry={...load,id:"wait",kind:"wait_start"};
assert.throws(()=>confirmTripEvent(snapshot,[wait],intent,now));
assert.equal(confirmTripEvent(snapshot,[wait],{...intent,kind:"wait_end"},now).id,"trip");
console.log("PASS native confirmation: fresh durable state rejects stale dialog after reassignment/cancellation/delivery/shift/privacy changes; pending local actions respected; future/stale boards blocked");
