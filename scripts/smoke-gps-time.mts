import assert from "node:assert/strict";
import { cleanTrack, dayStartIso, hoursToday } from "../src/lib/driver-log";
assert.equal(dayStartIso(new Date("2026-10-25T12:00:00Z")),"2026-10-24T21:00:00.000Z");
assert.equal(dayStartIso(new Date("2026-03-29T12:00:00Z")),"2026-03-28T22:00:00.000Z");
const p=(capturedAt:string,at:string,lat:number)=>({truckId:"t",capturedAt,at,lat,lng:22});
const a=p("2026-10-25T00:59:50Z","2026-10-25T03:59",46);
const b=p("2026-10-25T01:00:20Z","2026-10-25T03:00",46.001);
const track=cleanTrack([b,a]);assert.equal(track.pts.length,2);assert.equal(track.pts[1].timestamp-track.pts[0].timestamp,30000);assert.ok(track.km>0.1 && track.km<0.12);
const gap=p("2026-10-25T02:00:00Z","2026-10-25T04:00",46.1);
assert.equal(cleanTrack([a,gap]).km,0,"unobserved hour is not counted as driven distance");
assert.equal(hoursToday({start:"2026-10-24T21:00:00Z",end:"2026-10-25T02:00:00Z"},[],Date.parse("2026-10-25T12:00:00Z")),5);
console.log("PASS live GPS UTC: DST day boundary, 30-second timing, chronological fixes, unknown-distance gaps and shift hours");

const parked = Array.from({length:21}, (_,i) => p(new Date(Date.parse("2026-10-17T07:00:00Z")+i*60000).toISOString(), `2026-10-17T10:${String(i).padStart(2,"0")}`,46));
const departure = p("2026-10-17T07:21:00Z","2026-10-17T10:21",46.001);
assert.ok(cleanTrack([...parked,departure]).km > .1, "stationary observations bridge a real stop, not a GPS outage");
assert.equal(cleanTrack([parked[0],p("2026-10-17T07:00:01Z","2026-10-17T10:00",46.003)]).km,0,"a sub-500m one-second GPS jump is not driving");
console.log("PASS GPS noise: stationary fixes preserve continuity; short impossible-speed jumps rejected");
