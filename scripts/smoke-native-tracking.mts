import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const memory = new Map<string, unknown>();
let callback: (event: unknown)=>Promise<void>, running=false, sends=0, offline=false;
let state={enabled:true,vehicleId:"truck-a",shiftStart:"2026-10-17T08:00:00Z"};
class ApiError extends Error { constructor(public status:number){super("api");} }
let denied=0;
const api = async (path:string) => {
 if(offline)throw new Error("offline");if(denied)throw new ApiError(denied);
 if(path.endsWith("/tracking"))return state;
 if(path.endsWith("/ping")){sends++;return;}
};
const service={api,ApiError,read:async(k:string)=>memory.get(k)??null,write:async(k:string,v:unknown)=>{memory.set(k,v);},remove:async(k:string)=>{memory.delete(k);},abortRequests:()=>{}};
const location={hasStartedLocationUpdatesAsync:async()=>running,stopLocationUpdatesAsync:async()=>{running=false;},requestForegroundPermissionsAsync:async()=>({granted:true}),requestBackgroundPermissionsAsync:async()=>({granted:true}),startLocationUpdatesAsync:async()=>{running=true;},Accuracy:{High:4},ActivityType:{AutomotiveNavigation:1}};
const source=ts.transpileModule(fs.readFileSync("apps/driver/src/tracking.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module={exports:{} as Record<string, (...args:any[])=>Promise<void>>};
new Function("require","module","exports",source)((name:string)=>name==="expo-task-manager"?{defineTask:(_name:string,fn:typeof callback)=>{callback=fn;}}:name==="expo-location"?location:service,module,module.exports);
const t=module.exports;
const fix=(age=0,accuracy=10)=>({data:{locations:[{timestamp:Date.now()-age,coords:{latitude:46,longitude:22,accuracy}}]}});
await t.startGPS();assert.equal(running,true);assert.ok(memory.has("gps-gate"));
await callback!(fix());assert.equal(sends,1);
await callback!(fix(60000));await callback!(fix(0,100));assert.equal(sends,1);
await t.stopGPS();await callback!(fix());assert.equal(sends,1);assert.equal(running,false);
console.log("PASS native collector: explicit start, accuracy/age filters, durable stop suppresses later callbacks");
await t.startGPS();state={...state,vehicleId:"truck-b"};await callback!(fix());assert.equal(running,false);assert.equal(sends,1);
state={...state,vehicleId:"truck-a"};await t.startGPS();denied=401;await callback!(fix());assert.equal(running,false);denied=0;
await t.startGPS();offline=true;await callback!(fix());assert.equal(sends,1);assert.match(JSON.stringify(memory.get("gps-status")),/Fără confirmare/);
await assert.rejects(t.privateOrStop({path:"/api/driver/private",body:{vehicleId:"truck-a",on:true}}));
assert.equal(running,false);assert.equal(memory.has("gps-gate"),false);assert.ok(memory.has("pending-control"));
await assert.rejects(t.startGPS());assert.equal(running,false);
offline=false;await t.syncPending();assert.equal(memory.has("pending-control"),false);
console.log("PASS native failures: assignment change, expired session, no internet, offline privacy and pending-control retry");
