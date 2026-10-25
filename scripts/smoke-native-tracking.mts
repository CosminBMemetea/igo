import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const memory = new Map<string, unknown>();
let callback: (event: unknown)=>Promise<void>, running=false, sends=0, offline=false, badStatusWrite=false, badGateRead=false;
let scope="account-a", denied=0, errorCode="", heldRequest:(()=>Promise<void>)|null=null, permission:(()=>Promise<{granted:boolean}>)|null=null;
let state={enabled:true,vehicleId:"truck-a",shiftStart:"2026-10-17T08:00:00Z"};
const controlsSent: unknown[]=[];
class ApiError extends Error { constructor(public status:number,public code=""){super("api");} }
const api = async (path:string,body?:unknown,opts?:{scope?:string}) => {
 if(opts?.scope && opts.scope!==scope)throw new ApiError(409,"account-changed");
 if(offline)throw new Error("offline");if(denied)throw new ApiError(denied,errorCode);
 if(path.endsWith("/tracking"))return state;
 if(path.endsWith("/ping")){sends++;return;}
 controlsSent.push(body);if(heldRequest){const wait=heldRequest;heldRequest=null;await wait();}
};
const service={api,ApiError,sessionScope:async()=>scope,read:async(k:string)=>{if(badGateRead&&k==="gps-gate")throw Error("storage");return memory.get(k)??null;},write:async(k:string,v:unknown)=>{if(badStatusWrite&&k==="gps-status")throw Error("storage");memory.set(k,v);},remove:async(k:string)=>{memory.delete(k);},abortGPSRequests:()=>{}};
let foregroundGranted=true, backgroundGranted=true, canAskAgain=true, foregroundRequests=0, backgroundRequests=0;
const location={getForegroundPermissionsAsync:async()=>({granted:permission?false:foregroundGranted,canAskAgain}),getBackgroundPermissionsAsync:async()=>({granted:backgroundGranted,canAskAgain}),hasStartedLocationUpdatesAsync:async()=>running,stopLocationUpdatesAsync:async()=>{running=false;},requestForegroundPermissionsAsync:async()=>{foregroundRequests++;return permission?permission():({granted:true});},requestBackgroundPermissionsAsync:async()=>{backgroundRequests++;return {granted:true};},startLocationUpdatesAsync:async()=>{running=true;},Accuracy:{High:4},ActivityType:{AutomotiveNavigation:1}};
let notificationGranted=false;
let notificationResult="granted", notificationRequests=0, notificationPermission:(()=>Promise<string>)|null=null;
const native={Platform:{OS:"ios",Version:27},PermissionsAndroid:{PERMISSIONS:{POST_NOTIFICATIONS:"notifications"},RESULTS:{GRANTED:"granted"},check:async()=>notificationGranted,request:async()=>{notificationRequests++;return notificationPermission?notificationPermission():notificationResult;}}};
const modules = new Map<string,any>();
function load(name:string):any {
 if(modules.has(name))return modules.get(name);
 const output=ts.transpileModule(fs.readFileSync(`apps/driver/src/${name}.ts`,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};
 new Function("require","module","exports",output)((dep:string)=>dep==="expo-task-manager"?{defineTask:(_name:string,fn:typeof callback)=>{callback=fn;}}:dep==="expo-location"?location:dep==="react-native"?native:dep==="expo-notifications"?{AndroidImportance:{HIGH:4},setNotificationChannelAsync:async()=>{},scheduleNotificationAsync:async()=>"n"}:dep==="./api"?service:load(dep.slice(2)),module,module.exports);
 modules.set(name,module.exports);return module.exports;
}
const t=load("tracking"), c=load("controls");
const tick=()=>new Promise(r=>setTimeout(r,0));
const fix=(age=0,accuracy=10)=>({data:{locations:[{timestamp:Date.now()-age,coords:{latitude:46,longitude:22,accuracy}}]}});
const pending={path:"/api/driver/private",body:{vehicleId:"truck-a",expectedShiftStart:state.shiftStart,on:true}};
await t.startGPS();assert.equal(running,true);assert.ok(memory.has("gps-gate"));
await callback!(fix());assert.equal(sends,1);
await callback!(fix(60000));await callback!(fix(0,100));assert.equal(sends,1);
await t.stopGPS();await callback!(fix());assert.equal(sends,1);assert.equal(running,false);
console.log("PASS native collector: explicit start, accuracy/age filters, durable stop suppresses later callbacks");
await t.startGPS();state={...state,vehicleId:"truck-b"};await callback!(fix());assert.equal(running,false);assert.equal(sends,1);
state={...state,vehicleId:"truck-a"};await t.startGPS();denied=401;await callback!(fix());assert.equal(running,false);denied=0;
await t.startGPS();offline=true;await callback!(fix());assert.equal(sends,1);assert.match(JSON.stringify(memory.get("gps-status")),/Fără confirmare/);
await assert.rejects(t.privateOrStop(pending));
assert.equal(running,false);assert.equal(memory.has("gps-gate"),false);assert.ok(await c.pendingControl());
await assert.rejects(t.startGPS());assert.equal(running,false);
scope="account-b";assert.equal(await c.pendingControl(),null);offline=false;const before=controlsSent.length;await t.syncPending();assert.equal(controlsSent.length,before);
scope="account-a";await t.syncPending();assert.equal(await c.pendingControl(),null);
console.log("PASS native failures: assignment/expiry/offline stop; queued controls isolated per account and replayed on return");
// New command while a previous command's ACK is delayed must survive that ACK.
await c.queueControl(pending);
let release!:()=>void;heldRequest=()=>new Promise<void>(r=>{release=r;});
const first=t.syncPending();await tick();
const secondCommand={path:"/api/driver/shift",body:{vehicleId:"truck-a",expectedShiftStart:state.shiftStart,action:"stop"}};
await c.queueControl(secondCommand);const second=t.syncPending();release();await Promise.all([first,second]);
assert.equal(await c.pendingControl(),null);assert.deepEqual(controlsSent.at(-1),secondCommand.body);
await c.queueControl(secondCommand);await c.queueControl(pending);
assert.equal((await c.pendingControl()).path,"/api/driver/shift");await t.syncPending();
assert.deepEqual(controlsSent.at(-1),secondCommand.body,"private cannot downgrade an offline shift stop");
await c.queueControl(pending);denied=409;errorCode="stale-shift";await t.syncPending();assert.equal(await c.pendingControl(),null);denied=0;errorCode="";
console.log("PASS offline controls: delayed ACK cannot erase new intent; obsolete shift commands retired without retry loops");
await t.startGPS();badStatusWrite=true;await assert.rejects(t.stopGPS());assert.equal(running,false);assert.equal(memory.has("gps-gate"),false);badStatusWrite=false;
await t.startGPS();badGateRead=true;await callback!(fix());assert.equal(running,false);badGateRead=false;
let grant!:()=>void;permission=()=>new Promise(r=>{grant=()=>r({granted:true});});
const start=t.startGPS();await tick();await t.stopGPS();grant();await assert.rejects(start);assert.equal(running,false);permission=null;
console.log("PASS native stop: storage failure still shuts down service; delayed permission result cannot restart GPS");

native.Platform.OS="android";native.Platform.Version=33;notificationResult="denied";
await assert.rejects(t.startGPS(),/notificările/);assert.equal(running,false);assert.equal(memory.has("gps-gate"),false);
notificationResult="granted";await t.startGPS();assert.equal(running,true);await t.stopGPS();
let allowNotifications!:()=>void;notificationPermission=()=>new Promise(r=>{allowNotifications=()=>r("granted");});
const delayedNotification=t.startGPS();await tick();await t.stopGPS();allowNotifications();await assert.rejects(delayedNotification);assert.equal(running,false);notificationPermission=null;
const notificationCount=notificationRequests;native.Platform.Version=32;await t.startGPS();await t.stopGPS();assert.equal(notificationRequests,notificationCount);
console.log("PASS Android notification consent: denial blocks GPS, grant starts it, delayed grant cannot override stop, Android 12 skips Android 13 permission");

const fgCount=foregroundRequests, bgCount=backgroundRequests, ntCount=notificationRequests;
native.Platform.Version=33;notificationGranted=true;
await t.startGPS();await t.stopGPS();await t.startGPS();await t.stopGPS();
assert.equal(foregroundRequests,fgCount);assert.equal(backgroundRequests,bgCount);assert.equal(notificationRequests,ntCount);
foregroundGranted=false;canAskAgain=false;await assert.rejects(t.startGPS(),/locația/);assert.equal(foregroundRequests,fgCount);
foregroundGranted=true;backgroundGranted=false;await assert.rejects(t.startGPS(),/Tot timpul/);assert.equal(backgroundRequests,bgCount);
backgroundGranted=true;canAskAgain=true;state.enabled=false;await assert.rejects(t.startGPS(),/tură deschisă/);assert.equal(foregroundRequests,fgCount);state.enabled=true;
await t.startGPS();running=false;await t.reconcileGPS();assert.equal(memory.has("gps-gate"),false);assert.match(JSON.stringify(memory.get("gps-status")),/Telefonul a oprit/);
console.log("PASS permission persistence: no repeat prompts when granted; permanent denial opens no dialog; closed shift cannot prompt; killed native service clears stale GPS status");
{ // r26 ping rules, same as web: 5 s cap, exponential backoff, 429 waits ≥ 60 s, a dropped (422 before-shift) fix does not back off.
  const z={last:0,until:0,fails:0}, now=1_000_000;
  assert.equal(t.mayPing(null,now),true);
  const ok=t.nextThrottle(z,now,"ok");assert.equal(t.mayPing(ok,now+4999),false);assert.equal(t.mayPing(ok,now+5000),true);
  const f1=t.nextThrottle(ok,now,"fail"), f2=t.nextThrottle(f1,now,"fail");assert.equal(f1.until-now,10000);assert.equal(f2.until-now,20000);
  assert.equal(t.nextThrottle({last:0,until:0,fails:20},now,"fail").until-now,300000);
  assert.ok(t.nextThrottle(z,now,"limited").until-now>=60000);
  const d=t.nextThrottle(f2,now,"drop");assert.equal(d.fails,2);assert.equal(t.nextThrottle(d,now,"ok").fails,0);
  console.log("PASS ping throttle: 5 s cap, backoff, 429 pause, before-shift drop keeps GPS");
}
